import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createTestDatabase, asUser } from "../../scripts/db-harness.mjs";

let db;
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = uid(1),
  B = uid(2),
  C = uid(3),
  OWNER = uid(4),
  MOD = uid(5),
  EDITOR = OWNER,
  DEPARTING = uid(9),
  LIFE = uid(11);
let titles = [];
let collection;
let imported;
const run = (id, sql, params = [], claims = {}) =>
  asUser(db, id, sql, params, claims);
async function service(sql, params = []) {
  await db.exec("reset role");
  await db.query(
    "select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims','{}',false)",
  );
  await db.exec("set role service_role");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
async function fails(action, codes = ["42501"]) {
  await assert.rejects(
    action,
    (error) => codes.includes(error.code),
    `Expected ${codes.join("/")}`,
  );
}
before(async () => {
  db = await createTestDatabase();
  for (let n = 1; n <= 14; n++)
    await db.query(
      "insert into auth.users(id,raw_user_meta_data) values($1,$2)",
      [
        uid(n),
        JSON.stringify({
          full_name: `Isolated fixture ${n}`,
          role: "super_admin",
          email: "never-copied@example.invalid",
        }),
      ],
    );
  await service("select public.bootstrap_platform_owner($1)", [OWNER]);
  const invitation = (await run(OWNER, "select public.invite_moderator($1,'Isolated moderator appointment') id", [MOD])).rows[0].id;
  await run(MOD, "select public.respond_moderator_invitation($1,true)", [invitation]);
  for (const kind of ["movie", "anime", "series"]) {
    const { rows } = await db.query(
      "insert into public.titles(display_title,kind,status) values('Isolated catalog fixture',$1,'released') returning id",
      [kind],
    );
    titles.push(rows[0].id);
  }
});
after(async () => {
  if (db) await db.close();
});

test("all application tables have RLS; definer functions pin search_path and reject anonymous execution", async () => {
  const { rows } = await db.query(
    "select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relkind='r'",
  );
  assert.ok(rows.length >= 50);
  assert.ok(rows.every((row) => row.relrowsecurity));
  const funcs = await db.query(
    "select p.proname,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.prosecdef",
  );
  assert.ok(
    funcs.rows.every((row) => row.proconfig?.includes('search_path=""')),
  );
  const leaked = await db.query(
    "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and has_function_privilege('anon',p.oid,'EXECUTE') and p.proname not in ('catalog_title_extras','catalog_freshness','public_title_cache_allowed','browse_catalog','title_card_data','community_rating','resolve_title','read_avatar','write_avatar','read_cover','write_cover')",
  );
  assert.deepEqual(leaked.rows, []);
});
test("profile initialization copies no email/role; usernames are unique, case-insensitive and permanent", async () => {
  const own = await run(A, "select * from public.profiles where id=$1", [A]);
  assert.equal(own.rows[0].username, null);
  assert.equal("email" in own.rows[0], false);
  assert.equal(
    (await run(A, "select * from public.admin_roles")).rows.length,
    0,
  );
  await run(
    A,
    "select public.complete_onboarding('Film_Lover','Fixture A',array['anime']::public.entertainment_kind[])",
  );
  assert.equal(
    (await run(A, "select username from public.profiles where id=$1", [A]))
      .rows[0].username,
    "film_lover",
  );
  await fails(
    () => run(B, "select public.complete_onboarding('FILM_LOVER','Fixture B')"),
    ["23505"],
  );
  await fails(() =>
    run(A, "update public.profiles set username='new_name' where id=$1", [A]),
  );
  await fails(
    () =>
      db.query("update public.profiles set username='new_name' where id=$1", [
        A,
      ]),
    ["23514"],
  );
  await run(
    A,
    "update public.profiles set bio='My own bio' where id=$1 returning id",
    [A],
  );
  assert.equal(
    (
      await run(
        B,
        "update public.profiles set bio='intrusion' where id=$1 returning id",
        [A],
      )
    ).rows.length,
    0,
  );
  await fails(() =>
    run(A, "update public.profiles set status='banned' where id=$1", [B]),
  );
  await fails(() => run(null, "select id from public.profiles"));
});
test("tracking and its automatic history are owner-only, even for administrators", async () => {
  await run(A, "select public.set_tracking($1,'planned')", [titles[0]]);
  await run(A, "select public.set_tracking($1,'watching')", [titles[0]]);
  assert.equal((await run(A, "select * from public.tracking")).rows.length, 1);
  assert.equal(
    (await run(A, "select * from public.tracking_history")).rows.length,
    2,
  );
  for (const other of [B, MOD, OWNER]) {
    assert.equal(
      (await run(other, "select * from public.tracking where user_id=$1", [A]))
        .rows.length,
      0,
    );
    assert.equal(
      (
        await run(
          other,
          "select * from public.tracking_history where user_id=$1",
          [A],
        )
      ).rows.length,
      0,
    );
  }
  await fails(() =>
    run(
      A,
      "insert into public.tracking(user_id,title_id,status) values($1,$2,'planned')",
      [B, titles[1]],
    ),
  );
  await fails(() =>
    run(
      A,
      "insert into public.tracking_history(user_id,title_id,next_status) values($1,$2,'completed')",
      [A, titles[0]],
    ),
  );
});
test("ratings reject rounding, duplicates and out-of-range values; histories stay private", async () => {
  for (const score of [0, 10.1, 1.23, "NaN", "Infinity"])
    await fails(
      () => run(A, "select public.set_rating($1,$2)", [titles[0], score]),
      ["23514"],
    );
  await run(A, "select public.set_rating($1,8.1)", [titles[0]]);
  await run(A, "select public.set_rating($1,8.2)", [titles[0]]);
  assert.equal((await run(A, "select * from public.ratings")).rows.length, 1);
  assert.equal(
    (await run(A, "select * from public.rating_history")).rows.length,
    2,
  );
  assert.equal((await run(B, "select * from public.ratings")).rows.length, 0);
  assert.equal(
    (
      await run(OWNER, "select * from public.rating_history where user_id=$1", [
        A,
      ])
    ).rows.length,
    0,
  );
  await fails(() => run(A, "update public.ratings set eligible=false"));
});
test("community aggregates expose no identities and only active eligible contributions", async () => {
  for (let n = 10; n <= 14; n++)
    await run(uid(n), "select public.set_rating($1,$2)", [titles[1], n - 6]);
  let aggregate = (
    await run(null, "select public.community_rating($1) value", [titles[1]])
  ).rows[0].value;
  assert.deepEqual(aggregate, { score: 6, voteCount: 5, minimumVotes: 5 });
  await db.query("update public.profiles set status='suspended' where id=$1", [
    uid(14),
  ]);
  aggregate = (
    await run(B, "select public.community_rating($1) value", [titles[1]])
  ).rows[0].value;
  assert.deepEqual(aggregate, { score: null, voteCount: 4, minimumVotes: 5 });
  await db.query("update public.profiles set status='active' where id=$1", [
    uid(14),
  ]);
});
test("favorites are unique and cannot be read or inserted for another user", async () => {
  await run(A, "insert into public.favorites(title_id) values($1)", [
    titles[0],
  ]);
  await fails(
    () =>
      run(A, "insert into public.favorites(title_id) values($1)", [titles[0]]),
    ["23505"],
  );
  assert.equal(
    (await run(B, "select * from public.favorites where user_id=$1", [A])).rows
      .length,
    0,
  );
  await fails(() =>
    run(A, "insert into public.favorites(user_id,title_id) values($1,$2)", [
      B,
      titles[1],
    ]),
  );
});
test("collections default private, items respect the parent, and reorder is atomic and complete", async () => {
  collection = (
    await run(
      A,
      "insert into public.collections(title) values('Isolated collection fixture') returning id,visibility",
    )
  ).rows[0];
  assert.equal(collection.visibility, "private");
  const itemIds = [];
  for (const title of titles)
    itemIds.push(
      (
        await run(A, "select public.add_collection_item($1,$2) id", [
          collection.id,
          title,
        ])
      ).rows[0].id,
    );
  assert.equal(
    (
      await run(B, "select * from public.collections where id=$1", [
        collection.id,
      ])
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await run(
        B,
        "select * from public.collection_items where collection_id=$1",
        [collection.id],
      )
    ).rows.length,
    0,
  );
  await fails(() =>
    run(B, "select public.add_collection_item($1,$2)", [
      collection.id,
      titles[0],
    ]),
  );
  await run(A, "select public.reorder_collection_items($1,$2)", [
    collection.id,
    [...itemIds].reverse(),
  ]);
  const ordered = (
    await run(
      A,
      "select id from public.collection_items where collection_id=$1 order by position",
      [collection.id],
    )
  ).rows.map((row) => row.id);
  assert.deepEqual(ordered, [...itemIds].reverse());
  await fails(
    () =>
      run(A, "select public.reorder_collection_items($1,$2)", [
        collection.id,
        [itemIds[0], itemIds[0], itemIds[2]],
      ]),
    ["23514"],
  );
  assert.deepEqual(
    (
      await run(
        A,
        "select id from public.collection_items where collection_id=$1 order by position",
        [collection.id],
      )
    ).rows.map((row) => row.id),
    ordered,
  );
  await fails(
    () =>
      run(A, "select public.add_collection_item($1,$2)", [
        collection.id,
        titles[0],
      ]),
    ["23505"],
  );
});
test("saving references live originals; importing is private, independent and hides importer identities", async () => {
  await run(
    A,
    "update public.collections set visibility='published' where id=$1",
    [collection.id],
  );
  await run(
    B,
    "insert into public.collection_saves(collection_id) values($1)",
    [collection.id],
  );
  await run(
    B,
    "insert into public.collection_favorites(collection_id) values($1)",
    [collection.id],
  );
  imported = (
    await run(B, "select public.import_collection($1) id", [collection.id])
  ).rows[0].id;
  assert.equal(
    (
      await run(B, "select visibility from public.collections where id=$1", [
        imported,
      ])
    ).rows[0].visibility,
    "private",
  );
  assert.equal(
    (
      await run(
        A,
        "select * from public.collection_saves where collection_id=$1",
        [collection.id],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await run(
        A,
        "select * from public.collection_imports where source_collection_id=$1",
        [collection.id],
      )
    ).rows.length,
    0,
  );
  assert.deepEqual(
    (
      await run(A, "select public.collection_metrics($1) counts", [
        collection.id,
      ])
    ).rows[0].counts,
    { favorites: 1, saves: 1, imports: 1 },
  );
  await fails(() =>
    run(C, "select public.collection_metrics($1)", [collection.id]),
  );
  await run(
    A,
    "update public.collection_items set creator_note='Changed original' where collection_id=$1",
    [collection.id],
  );
  assert.ok(
    (
      await run(
        B,
        "select creator_note from public.collection_items where collection_id=$1",
        [imported],
      )
    ).rows.every((row) => row.creator_note === ""),
  );
  await run(
    A,
    "update public.collections set visibility='private' where id=$1",
    [collection.id],
  );
  assert.equal(
    (await run(B, "select * from public.collection_saves")).rows.length,
    0,
  );
  assert.equal(
    (
      await run(
        B,
        "select * from public.collection_items where collection_id=$1",
        [imported],
      )
    ).rows.length,
    3,
  );
});
test("imported copies survive creator deletion with anonymized source attribution", async () => {
  const source = (
    await run(
      DEPARTING,
      "insert into public.collections(title,visibility) values('Disposable test source','published') returning id",
    )
  ).rows[0].id;
  await run(DEPARTING, "select public.add_collection_item($1,$2)", [
    source,
    titles[0],
  ]);
  await run(DEPARTING, "select public.set_tracking($1,'completed')", [
    titles[0],
  ]);
  await run(DEPARTING, "select public.set_rating($1,7)", [titles[0]]);
  const copy = (
    await run(B, "select public.import_collection($1) id", [source])
  ).rows[0].id;
  // Deleting the stub auth row is confined to this disposable in-memory test database.
  await db.query("delete from auth.users where id=$1", [DEPARTING]);
  assert.equal(
    (
      await run(
        B,
        "select * from public.collection_items where collection_id=$1",
        [copy],
      )
    ).rows.length,
    1,
  );
  const attribution = (
    await run(
      B,
      "select source_owner_id,source_collection_id from public.collection_imports where imported_collection_id=$1",
      [copy],
    )
  ).rows[0];
  assert.deepEqual(attribution, {
    source_owner_id: null,
    source_collection_id: null,
  });
});
test("following is immediate, duplicate/self follows fail, and blocks remove both directions and access", async () => {
  await run(A, "insert into public.follows(followed_id) values($1)", [B]);
  await run(B, "insert into public.follows(followed_id) values($1)", [A]);
  await fails(
    () => run(A, "insert into public.follows(followed_id) values($1)", [B]),
    ["23505"],
  );
  await fails(
    () => run(A, "insert into public.follows(followed_id) values($1)", [A]),
    ["23514"],
  );
  await run(
    A,
    "update public.collections set visibility='published' where id=$1",
    [collection.id],
  );
  await run(B, "insert into public.blocks(blocked_id) values($1)", [A]);
  for (const [viewer, target] of [
    [A, B],
    [B, A],
  ])
    assert.equal(
      (
        await run(viewer, "select id from public.profiles where id=$1", [
          target,
        ])
      ).rows.length,
      0,
    );
  assert.equal(
    (
      await run(B, "select * from public.collections where id=$1", [
        collection.id,
      ])
    ).rows.length,
    0,
  );
  await fails(() =>
    run(A, "insert into public.follows(followed_id) values($1)", [B]),
  );
  assert.equal(
    (
      await db.query(
        "select * from public.follows where follower_id in ($1,$2) and followed_id in ($1,$2)",
        [A, B],
      )
    ).rows.length,
    0,
  );
  await run(B, "delete from public.blocks where blocked_id=$1", [A]);
});
test("notifications are recipient-owned, generated by events, preference-aware and unspoofable", async () => {
  await run(C, "insert into public.follows(followed_id) values($1)", [B]);
  const own = (
    await run(B, "select * from public.notifications where actor_id=$1", [C])
  ).rows;
  assert.equal(own.length, 1);
  assert.equal(
    (
      await run(C, "select * from public.notifications where recipient_id=$1", [
        B,
      ])
    ).rows.length,
    0,
  );
  await fails(() =>
    run(
      C,
      "insert into public.notifications(recipient_id,actor_id,kind,dedupe_key) values($1,$2,'new_follower','fake')",
      [B, C],
    ),
  );
  await run(B, "update public.notifications set read_at=now() where id=$1", [
    own[0].id,
  ]);
  await fails(() =>
    run(B, "update public.notifications set actor_id=$1 where id=$2", [
      A,
      own[0].id,
    ]),
  );
  await run(
    B,
    "update public.notification_preferences set enabled=false where user_id=$1",
    [B],
  );
  await run(uid(8), "insert into public.follows(followed_id) values($1)", [B]);
  assert.equal(
    (
      await run(B, "select * from public.notifications where actor_id=$1", [
        uid(8),
      ])
    ).rows.length,
    0,
  );
});
test("role management requires the configured owner AND the server role; moderators cannot read private ratings", async () => {
  await fails(() =>
    run(OWNER, "select public.manage_admin_role($1,$2,'super_admin',true)", [
      OWNER,
      B,
    ]),
  );
  await fails(() =>
    service("select public.manage_admin_role($1,$2,'super_admin',true)", [
      MOD,
      B,
    ]),
  );
  await fails(() =>
    run(
      B,
      "select public.catalog_edit_title(null,'Unauthorized','movie')",
      [],
      { role: "super_admin" },
    ),
  );
  assert.equal(
    (await run(MOD, "select * from public.ratings where user_id=$1", [A])).rows
      .length,
    0,
  );
  const report = (
    await run(
      C,
      "select public.submit_report($1,null,'spam','Isolated test report') id",
      [A],
    )
  ).rows[0].id;
  assert.equal(
    (await run(B, "select * from public.reports where id=$1", [report])).rows
      .length,
    0,
  );
  await fails(() =>
    run(B, "select public.moderate_report($1,'warning','No permission')", [
      report,
    ]),
  );
  await fails(() =>
    run(
      MOD,
      "select public.admin_account_action($1,'ban','Administrators are protected')",
      [OWNER],
    ),
  );
  await run(
    MOD,
    "select public.moderate_report($1,'warning','Isolated moderation fixture')",
    [report],
  );
  assert.ok(
    (
      await run(OWNER, "select * from public.audit_logs where entity_id=$1", [
        report,
      ])
    ).rows.length > 0,
  );
  await fails(() => run(MOD, "delete from public.audit_logs"));
});
test("catalog corrections/merges require editors and retain all canonical references", async () => {
  await fails(() =>
    run(A, "select public.catalog_edit_title(null,'Not authorized','movie')"),
  );
  const correction = (
    await run(
      A,
      "select public.suggest_correction($1,'display_title','Corrected fixture','A test correction') id",
      [titles[0]],
    )
  ).rows[0].id;
  await fails(() =>
    run(A, "select public.review_catalog_submission('correction',$1,true)", [
      correction,
    ]),
  );
  await run(
    EDITOR,
    "select public.review_catalog_submission('correction',$1,true)",
    [correction],
  );
  assert.equal(
    (
      await run(A, "select display_title from public.titles where id=$1", [
        titles[0],
      ])
    ).rows[0].display_title,
    "Corrected fixture",
  );
  const merge = (
    await run(
      EDITOR,
      "select public.propose_catalog_merge($1,$2,'Test reviewed merge') id",
      [titles[0], titles[2]],
    )
  ).rows[0].id;
  await run(
    EDITOR,
    "select public.review_catalog_submission('merge',$1,true)",
    [merge],
  );
  assert.equal(
    (await run(null, "select public.resolve_title($1) id", [titles[0]])).rows[0]
      .id,
    titles[2],
  );
  assert.equal(
    (await run(A, "select title_id from public.tracking")).rows[0].title_id,
    titles[0],
  );
  await fails(
    () => db.query("delete from public.titles where id=$1", [titles[0]]),
    ["23503", "23001"],
  );
});
test("account lifecycle hides the account, requires fresh OAuth for recovery and enforces 30 days before purge", async () => {
  await fails(() => run(OWNER, "select public.request_account_deletion()"));
  const requested = (
    await run(LIFE, "select public.request_account_deletion() deadline")
  ).rows[0].deadline;
  assert.ok(new Date(requested).getTime() > Date.now() + 29 * 86400000);
  assert.equal(
    (await run(A, "select id from public.profiles where id=$1", [LIFE])).rows
      .length,
    0,
  );
  await fails(() => run(LIFE, "select public.set_rating($1,7)", [titles[0]]));
  await fails(() =>
    run(LIFE, "select public.recover_account()", [], {
      amr: [{ method: "oauth", timestamp: 1 }],
    }),
  );
  assert.equal(
    (await service("select public.claim_account_purge($1) ok", [LIFE])).rows[0]
      .ok,
    false,
  );
  await run(LIFE, "select public.recover_account()", [], {
    amr: [{ method: "oauth", timestamp: Math.ceil(Date.now() / 1000) }],
  });
  assert.equal(
    (await run(LIFE, "select status from public.profiles where id=$1", [LIFE]))
      .rows[0].status,
    "active",
  );
  await run(LIFE, "select public.request_account_deletion()");
  await fails(() =>
    run(
      LIFE,
      "update public.account_deletions set recover_until=now()+interval '60 days' where user_id=$1",
      [LIFE],
    ),
  );
  await db.query(
    "update public.account_deletions set requested_at=now()-interval '31 days',recover_until=now()-interval '1 day' where user_id=$1",
    [LIFE],
  );
  await fails(() =>
    run(LIFE, "select public.recover_account()", [], {
      amr: [{ method: "oauth", timestamp: Math.ceil(Date.now() / 1000) }],
    }),
  );
  assert.equal(
    (await service("select public.claim_account_purge($1) ok", [LIFE])).rows[0]
      .ok,
    true,
  );
  assert.equal(
    (await run(LIFE, "select status from public.profiles where id=$1", [LIFE]))
      .rows[0].status,
    "purging",
  );
});
test("private storage enforces ownership, current visibility and unguessable-path-independent access", async () => {
  const path = `${A}/${collection.id}/cover.webp`;
  await run(
    A,
    "insert into storage.objects(bucket_id,name,owner_id) values('scenestack-collection-covers',$1,$2)",
    [path, A],
  );
  assert.equal(
    (await run(B, "select * from storage.objects where name=$1", [path])).rows
      .length,
    0,
  );
  await run(
    A,
    "update public.collections set cover_path=$1,visibility='published' where id=$2",
    [path, collection.id],
  );
  assert.equal(
    (await run(B, "select * from storage.objects where name=$1", [path])).rows
      .length,
    1,
  );
  assert.equal(
    (
      await run(B, "delete from storage.objects where name=$1 returning id", [
        path,
      ])
    ).rows.length,
    0,
  );
  await fails(() =>
    run(
      B,
      "insert into storage.objects(bucket_id,name,owner_id) values('scenestack-collection-covers',$1,$2)",
      [`${A}/${collection.id}/intrusion.webp`, B],
    ),
  );
  await run(
    A,
    "update public.collections set visibility='private' where id=$1",
    [collection.id],
  );
  assert.equal(
    (await run(B, "select * from storage.objects where name=$1", [path])).rows
      .length,
    0,
  );
  const buckets = (
    await db.query(
      "select public,file_size_limit,allowed_mime_types from storage.buckets",
    )
  ).rows;
  assert.ok(
    buckets.every(
      (bucket) =>
        !bucket.public && !bucket.allowed_mime_types.includes("image/svg+xml"),
    ),
  );
});
test("personal export includes only the caller’s private rows and anonymous users have no protected grants", async () => {
  const exported = (await run(A, "select public.export_personal_data() data"))
    .rows[0].data;
  assert.equal(exported.profile.id, A);
  for (const key of [
    "tracking",
    "tracking_history",
    "ratings",
    "rating_history",
    "favorites",
  ])
    assert.ok(exported[key].every((row) => row.user_id === A));
  await fails(() => run(null, "select * from public.ratings"));
  await fails(() => run(null, "select public.export_personal_data()"));
  await fails(() =>
    run(
      A,
      "insert into public.reports(reporter_id,reason) values($1,'other')",
      [B],
    ),
  );
});

test("catalog aliases are searchable, query/sort limits are enforced, and providers fail without losing cached data", async () => {
  await db.query(
    "insert into public.title_names(title_id,name,name_kind) values($1,'UniqueRomanizedAlias','romanized')",
    [titles[1]],
  );
  const found = await run(
    A,
    "select id from public.search_catalog(p_query=>'UniqueRomanizedAlias',p_category=>'anime')",
  );
  assert.deepEqual(
    found.rows.map((row) => row.id),
    [titles[1]],
  );
  await fails(
    () =>
      run(
        A,
        "select * from public.search_catalog(p_sort=>'drop table profiles')",
      ),
    ["23514"],
  );
  await fails(
    () => run(A, "select * from public.search_catalog(p_limit=>101)"),
    ["23514"],
  );
  const provider = (
    await db.query(
      "insert into public.metadata_providers(key,name,approved,enabled) values('isolated_test_provider','Test-only provider',true,true) returning id",
    )
  ).rows[0].id;
  await service("select public.record_provider_sync($1,$2,true)", [
    titles[1],
    provider,
  ]);
  const success = (
    await db.query(
      "select last_success_at from public.provider_sync_state where title_id=$1 and provider_id=$2",
      [titles[1], provider],
    )
  ).rows[0].last_success_at;
  await service("select public.record_provider_sync($1,$2,false,'timeout')", [
    titles[1],
    provider,
  ]);
  const state = (
    await db.query(
      "select * from public.provider_sync_state where title_id=$1 and provider_id=$2",
      [titles[1], provider],
    )
  ).rows[0];
  assert.equal(state.state, "failed");
  assert.equal(state.attempts, 1);
  assert.deepEqual(state.last_success_at, success);
  assert.equal(
    (await run(A, "select * from public.titles where id=$1", [titles[1]])).rows
      .length,
    1,
  );
  await fails(
    () =>
      service(
        "select public.record_provider_sync($1,$2,false,'token=not-a-real-secret')",
        [titles[1], provider],
      ),
    ["23514"],
  );
});
test("service jobs cannot directly promote users, forge notifications, erase audit logs or read private ratings", async () => {
  await fails(() =>
    service(
      "insert into public.admin_roles(user_id,role) values($1,'super_admin')",
      [B],
    ),
  );
  await fails(() => service("delete from public.audit_logs"));
  await fails(() => service("select * from public.ratings"));
  await fails(() =>
    service(
      "insert into public.notifications(recipient_id,actor_id,kind,dedupe_key) values($1,$2,'new_follower','service-spoof')",
      [B, A],
    ),
  );
  await fails(
    () =>
      run(B, "select public.complete_onboarding(null,'Null username fixture')"),
    ["23514"],
  );
});
test("report submission rate limiting is transactional and cannot be bypassed by choosing an actor", async () => {
  for (let n = 0; n < 10; n++)
    await run(
      uid(12),
      "select public.submit_report($1,null,'other','Test-only quota fixture')",
      [C],
    );
  await fails(
    () =>
      run(
        uid(12),
        "select public.submit_report($1,null,'other','Over quota')",
        [C],
      ),
    ["P0001"],
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.reports where reporter_id=$1",
        [uid(12)],
      )
    ).rows[0].n,
    10,
  );
});
test("restrictive Storage policies withstand unrelated broad pre-existing policies", async () => {
  await db.exec(
    "grant select on storage.objects to anon; create policy isolated_broad_policy on storage.objects for all to anon,authenticated using(true) with check(true)",
  );
  const path = `${A}/${collection.id}/cover.webp`;
  assert.equal(
    (await run(null, "select * from storage.objects where name=$1", [path]))
      .rows.length,
    0,
  );
  assert.equal(
    (await run(B, "select * from storage.objects where name=$1", [path])).rows
      .length,
    0,
  );
  await fails(() =>
    run(
      B,
      "insert into storage.objects(bucket_id,name,owner_id) values('scenestack-avatars',$1,$2)",
      [`${A}/spoof.png`, B],
    ),
  );
  await db.exec("drop policy isolated_broad_policy on storage.objects");
});
test("preference edits are owner-only and transactional, without changing a permanent username", async () => {
  await run(
    A,
    "select public.set_discovery_preferences(array['movie']::public.entertainment_kind[])",
  );
  await fails(
    () =>
      run(
        A,
        "select public.set_discovery_preferences(array['anime']::public.entertainment_kind[],array[$1]::uuid[])",
        [uid(99)],
      ),
    ["23503"],
  );
  assert.equal(
    (await run(A, "select category from public.preferred_categories")).rows[0]
      .category,
    "movie",
  );
  assert.equal(
    (
      await run(
        B,
        "select * from public.preferred_categories where user_id=$1",
        [A],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (await run(A, "select username from public.profiles where id=$1", [A]))
      .rows[0].username,
    "film_lover",
  );
});
test("reviewed duplicate aliases do not double-count a member’s community ratings", async () => {
  await run(B, "select public.set_rating($1,4)", [titles[0]]);
  await run(B, "select public.set_rating($1,6)", [titles[2]]);
  const source = (
    await run(null, "select public.community_rating($1) value", [titles[0]])
  ).rows[0].value;
  const target = (
    await run(null, "select public.community_rating($1) value", [titles[2]])
  ).rows[0].value;
  assert.deepEqual(source, target);
  assert.equal(target.voteCount, 2);
  assert.equal(target.score, null);
});
