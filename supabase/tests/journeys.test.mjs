import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createTestDatabase, asUser } from "../../scripts/db-harness.mjs";
let db;
const A = "10000000-0000-4000-8000-000000000001",
  B = "10000000-0000-4000-8000-000000000002";
let ids = [],
  collection,
  copy,
  provider;
const run = (who, sql, params = []) => asUser(db, who, sql, params);
async function service(sql, params = []) {
  await db.exec("reset role");
  await db.query(
    "select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)",
  );
  await db.exec("set role service_role");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
before(async () => {
  db = await createTestDatabase();
  await db.query("insert into auth.users(id) values($1),($2)", [A, B]);
  for (let i = 0; i < 4; i++) {
    const r = await db.query(
      "insert into public.titles(display_title,kind,status,release_year) values($1,'movie','released',$2) returning id",
      [`Isolated journey fixture ${i}`, 2020 + i],
    );
    ids.push(r.rows[0].id);
  }
  await db.query(
    "insert into public.title_names(title_id,name,name_kind) values($1,'Isolated alternative name','alternative')",
    [ids[0]],
  );
});
after(async () => db?.close());
test("A: guest catalog search supports aliases, filters, limits and safe artwork DTOs without personal reads", async () => {
  const rows = await run(
    null,
    "select * from public.browse_catalog(p_query=>'Isolated alternative name')",
  );
  assert.equal(rows.rows[0].id, ids[0]);
  const page = await run(
    null,
    "select * from public.browse_catalog(p_year=>2021,p_limit=>1)",
  );
  assert.equal(page.rows.length, 1);
  assert.equal(page.rows[0].release_year, 2021);
  const cards = await run(null, "select public.title_card_data($1) as data", [
    ids,
  ]);
  assert.equal(cards.rows[0].data[0].rating.score, null);
  await assert.rejects(
    () => run(null, "select * from public.tracking"),
    (e) => e.code === "42501",
  );
});
test("B: onboarding drafts survive requests, usernames are immutable and starter titles become Planned once", async () => {
  await run(
    A,
    "select public.save_onboarding_progress(3,'journey_a','Journey A')",
  );
  await run(A, "select public.save_onboarding_starters($1)", [
    [ids[0], ids[1]],
  ]);
  const draft = await run(
    A,
    "select step,draft_username,draft_starter_titles from public.onboarding",
  );
  assert.equal(draft.rows[0].step, 3);
  assert.deepEqual(draft.rows[0].draft_starter_titles, [ids[0], ids[1]]);
  await run(
    A,
    "select public.complete_onboarding('journey_a','Journey A',array['movie']::public.entertainment_kind[],'{}',$1)",
    [[ids[0], ids[1]]],
  );
  await run(B, "select public.complete_onboarding('journey_b','Journey B')");
  assert.equal(
    (await run(A, "select * from public.tracking where status='planned'")).rows
      .length,
    2,
  );
  await assert.rejects(
    () =>
      run(A, "update public.profiles set username='changed' where id=$1", [A]),
    (e) => ["42501", "23514"].includes(e.code),
  );
});
test("C: watched, favorite and fractional rating persist independently and reject excess precision", async () => {
  await run(A, "select public.set_tracking($1,'completed')", [ids[0]]);
  await run(A, "select public.set_favorite($1,true)", [ids[0]]);
  await run(A, "select public.set_favorite($1,true)", [ids[0]]);
  await run(A, "select public.set_rating($1,8.7)", [ids[0]]);
  await assert.rejects(
    () => run(A, "select public.set_rating($1,8.71)", [ids[0]]),
    (e) => e.code === "23514",
  );
  await run(A, "delete from public.tracking where title_id=$1", [ids[0]]);
  assert.equal(
    (
      await run(A, "select score from public.ratings where title_id=$1", [
        ids[0],
      ])
    ).rows[0].score,
    "8.7",
  );
  assert.equal(
    (await run(A, "select * from public.favorites where title_id=$1", [ids[0]]))
      .rows.length,
    1,
  );
  assert.equal(
    (await run(B, "select * from public.ratings where user_id=$1", [A])).rows
      .length,
    0,
  );
});
test("D: collection creation and multi-title insertion are idempotent and private by default", async () => {
  const request = "20000000-0000-4000-8000-000000000001";
  const args = [request, "Isolated collection", "", ids.slice(0, 2)];
  const sql =
    "select public.create_collection_with_titles($1,$2,$3,p_titles=>$4) as id";
  collection = (await run(A, sql, args)).rows[0].id;
  assert.equal((await run(A, sql, args)).rows[0].id, collection);
  await run(A, "select public.add_titles_to_collections($1,$2)", [
    [collection],
    [ids[0], ids[2], ids[3]],
  ]);
  const items = await run(
    A,
    "select * from public.collection_items where collection_id=$1 order by position",
    [collection],
  );
  assert.equal(items.rows.length, 4);
  assert.deepEqual(
    items.rows.map((i) => i.title_id),
    ids,
  );
  assert.equal(
    (await run(B, "select * from public.collections where id=$1", [collection]))
      .rows.length,
    0,
  );
  await assert.rejects(
    () =>
      run(B, "select public.add_titles_to_collections($1,$2)", [
        [collection],
        [ids[0]],
      ]),
    (e) => e.code === "42501",
  );
});
test("E: keyboard/drag ordering, full collection sorting and creator notes persist atomically", async () => {
  let items = (
    await run(
      A,
      "select id,title_id from public.collection_items where collection_id=$1 order by position",
      [collection],
    )
  ).rows;
  await run(A, "select public.move_collection_item($1,$2,p_direction=>-1)", [
    collection,
    items[2].id,
  ]);
  items = (
    await run(
      A,
      "select id,title_id from public.collection_items where collection_id=$1 order by position",
      [collection],
    )
  ).rows;
  assert.deepEqual(
    items.map((i) => i.title_id),
    [ids[0], ids[2], ids[1], ids[3]],
  );
  await run(A, "select public.move_collection_item($1,$2,$3)", [
    collection,
    items[0].id,
    items[3].id,
  ]);
  await run(A, "select public.sort_collection_items($1,'release_year',true)", [
    collection,
  ]);
  items = (
    await run(
      A,
      "select id,title_id from public.collection_items where collection_id=$1 order by position",
      [collection],
    )
  ).rows;
  assert.deepEqual(
    items.map((i) => i.title_id),
    [...ids].reverse(),
  );
  await run(
    A,
    "update public.collection_items set creator_note='Fixture note' where id=$1",
    [items[0].id],
  );
  assert.equal(
    (
      await run(
        A,
        "select creator_note from public.collection_items where id=$1",
        [items[0].id],
      )
    ).rows[0].creator_note,
    "Fixture note",
  );
});
test("F: favorite/save/import are separate; unpublishing removes original access while copies survive deletion", async () => {
  await run(
    A,
    "update public.collections set visibility='published' where id=$1",
    [collection],
  );
  await run(B, "select public.set_collection_interaction($1,'favorite',true)", [
    collection,
  ]);
  await run(B, "select public.set_collection_interaction($1,'save',true)", [
    collection,
  ]);
  const request = "20000000-0000-4000-8000-000000000002";
  copy = (
    await run(B, "select public.import_collection_once($1,$2) as id", [
      collection,
      request,
    ])
  ).rows[0].id;
  assert.equal(
    (
      await run(B, "select public.import_collection_once($1,$2) as id", [
        collection,
        request,
      ])
    ).rows[0].id,
    copy,
  );
  assert.equal(
    (await run(B, "select * from public.library_collections('saved')")).rows
      .length,
    1,
  );
  assert.equal(
    (await run(B, "select * from public.library_collections('imported')"))
      .rows[0].visibility,
    "private",
  );
  await run(
    A,
    "update public.collections set title='Updated original',visibility='private' where id=$1",
    [collection],
  );
  assert.equal(
    (await run(B, "select * from public.collection_saves")).rows.length,
    0,
  );
  assert.equal(
    (await run(B, "select * from public.collection_favorites")).rows.length,
    0,
  );
  assert.equal(
    (await run(B, "select title from public.collections where id=$1", [copy]))
      .rows[0].title,
    "Isolated collection",
  );
  await run(A, "delete from public.collections where id=$1", [collection]);
  assert.equal(
    (
      await run(
        B,
        "select * from public.collection_items where collection_id=$1",
        [copy],
      )
    ).rows.length,
    4,
  );
});
test("G: follow is idempotent, creates real unread notifications and block removes both directions", async () => {
  await run(B, "select public.set_follow($1,true)", [A]);
  await run(B, "select public.set_follow($1,true)", [A]);
  const notifications = await run(
    A,
    "select * from public.notifications where kind='new_follower'",
  );
  assert.equal(notifications.rows.length, 1);
  await run(A, "select public.mark_all_notifications_read()");
  assert.ok(
    (await run(A, "select * from public.notifications")).rows.every(
      (n) => n.read_at,
    ),
  );
  await run(A, "insert into public.blocks(blocked_id) values($1)", [B]);
  assert.equal((await run(B, "select * from public.follows")).rows.length, 0);
  await run(A, "delete from public.blocks where blocked_id=$1", [B]);
});
test("H: recommendation feedback is private and Already seen does not complete tracking; export includes it", async () => {
  await run(A, "select public.set_title_feedback($1,'already_seen')", [ids[2]]);
  assert.equal(
    (await run(A, "select * from public.tracking where title_id=$1", [ids[2]]))
      .rows.length,
    0,
  );
  assert.equal(
    (await run(B, "select * from public.title_feedback where user_id=$1", [A]))
      .rows.length,
    0,
  );
  const recs = (await run(A, "select public.recommend_title_ids() as data"))
    .rows[0].data;
  assert.ok(!recs.some((t) => t.id === ids[2]));
  const data = (await run(A, "select public.export_personal_data() as data"))
    .rows[0].data;
  assert.equal(data.title_feedback[0].feedback, "already_seen");
  assert.equal(data.profile.id, A);
});
test("I: provider cache ingestion is service-only, approval-gated, idempotent and transactional", async () => {
  provider = (
    await db.query(
      "insert into public.metadata_providers(key,name) values('tmdb','Isolated provider fixture') returning id",
    )
  ).rows[0].id;
  const payload = {
    externalId: "9999999",
    media: "movie",
    title: "Isolated provider fixture",
    originalTitle: null,
    kind: "movie",
    edition: "standalone",
    description: "Fixture",
    year: 2024,
    status: "released",
    ageRating: null,
    popularity: 1,
    poster: null,
    backdrop: null,
    genres: ["Isolated genre"],
    countries: [],
    languages: [],
    aliases: ["Isolated provider alias"],
    credits: [
      {
        id: "9999999",
        name: "Isolated person",
        department: "cast",
        role: "Fixture role",
      },
    ],
    trailers: [],
    related: [],
  };
  await assert.rejects(
    () => run(A, "select public.ingest_tmdb_title($1,$2)", [provider, payload]),
    (e) => e.code === "42501",
  );
  await assert.rejects(
    () =>
      service("select public.ingest_tmdb_title($1,$2)", [provider, payload]),
    (e) => e.code === "42501",
  );
  await db.query(
    "update public.metadata_providers set approved=true,enabled=true where id=$1",
    [provider],
  );
  const first = (
    await service("select public.ingest_tmdb_title($1,$2) as id", [
      provider,
      payload,
    ])
  ).rows[0].id;
  assert.equal(
    (
      await service("select public.ingest_tmdb_title($1,$2) as id", [
        provider,
        payload,
      ])
    ).rows[0].id,
    first,
  );
  await assert.rejects(
    () =>
      service("select public.ingest_tmdb_title($1,$2)", [
        provider,
        {
          ...payload,
          title: "Must roll back",
          poster: "https://evil.invalid/x.jpg",
        },
      ]),
    (e) => e.code === "23514",
  );
  assert.equal(
    (
      await run(null, "select display_title from public.titles where id=$1", [
        first,
      ])
    ).rows[0].display_title,
    payload.title,
  );
  assert.equal(
    (
      await run(null, "select * from public.title_credits where title_id=$1", [
        first,
      ])
    ).rows.length,
    1,
  );
});

test("J: canonical title state preserves merge history and consolidates only after the owner acts", async () => {
  const source = ids[1],
    target = ids[3];
  await run(A, "select public.set_rating($1,7.3)", [source]);
  await run(A, "select public.set_favorite($1,true)", [source]);
  await db.query(
    "insert into public.title_redirects(source_id,target_id) values($1,$2)",
    [source, target],
  );
  await db.query("update public.titles set status='merged' where id=$1", [
    source,
  ]);
  const state = (
    await run(A, "select public.personal_title_states($1) as data", [[target]])
  ).rows[0].data[0];
  assert.equal(state.tracking, "planned");
  assert.equal(state.favorite, true);
  assert.equal(state.rating, 7.3);
  assert.equal(
    (
      await run(A, "select title_id from public.ratings where title_id=$1", [
        source,
      ])
    ).rows.length,
    1,
  );
  const library = (
    await run(A, "select * from public.library_titles('tracking')")
  ).rows;
  assert.ok(library.some((t) => t.id === target));
  assert.ok(!library.some((t) => t.id === source));
  await run(A, "select public.change_personal_title($1,'track','watching')", [
    target,
  ]);
  assert.equal(
    (await run(A, "select * from public.tracking where title_id=$1", [source]))
      .rows.length,
    0,
  );
  const updated = (
    await run(A, "select public.personal_title_states($1) as data", [[target]])
  ).rows[0].data[0];
  assert.equal(updated.tracking, "watching");
  assert.equal(updated.rating, 7.3);
  assert.equal(updated.favorite, true);
  assert.ok(
    (
      await run(A, "select * from public.tracking_history where title_id=$1", [
        source,
      ])
    ).rows.length > 0,
  );
  assert.equal(
    (
      await run(B, "select public.personal_title_states($1) as data", [
        [target],
      ])
    ).rows[0].data[0].tracking,
    null,
  );
});
test("K: private counts and paged collections are executable without granting internal guard helpers", async () => {
  assert.ok(
    (await run(A, "select public.my_library_counts() as data")).rows[0].data
      .ratings > 0,
  );
  await run(A, "insert into public.blocks(blocked_id) values($1)", [B]);
  const blocked = (await run(A, "select public.blocked_accounts() as data"))
    .rows[0].data;
  assert.equal(blocked[0].display_name, "Journey B");
  assert.equal(
    (await run(B, "select public.blocked_accounts() as data")).rows[0].data
      .length,
    0,
  );
  await run(A, "delete from public.blocks where blocked_id=$1", [B]);
  await assert.rejects(
    () => run(A, "select app_private.require_member()"),
    (e) => e.code === "42501",
  );
});

test("L: collection picker membership counts are exact and private", async () => {
  const data = (
    await run(B, "select public.collection_memberships($1,$2) as data", [
      [copy],
      [ids[0]],
    ])
  ).rows[0].data;
  assert.equal(data[0].count, 1);
  assert.deepEqual(
    (
      await run(A, "select public.collection_memberships($1,$2) as data", [
        [copy],
        [ids[0]],
      ])
    ).rows[0].data,
    [],
  );
  await assert.rejects(
    () =>
      run(null, "select public.collection_memberships($1,$2)", [
        [copy],
        [ids[0]],
      ]),
    (e) => e.code === "42501",
  );
});
