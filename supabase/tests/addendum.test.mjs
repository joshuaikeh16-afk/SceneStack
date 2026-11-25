import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createTestDatabase, asUser } from "../../scripts/db-harness.mjs";
let db, collection, provider;
let titles = [];
const A = "30000000-0000-4000-8000-000000000001",
  B = "30000000-0000-4000-8000-000000000002",
  OWNER = "30000000-0000-4000-8000-000000000003";
const run = (id, sql, args = []) => asUser(db, id, sql, args);
async function service(sql, args = []) {
  await db.exec("reset role");
  await db.query(
    "select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)",
  );
  await db.exec("set role service_role");
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
before(async () => {
  db = await createTestDatabase();
  await db.query("insert into auth.users(id) values($1),($2),($3)", [
    A,
    B,
    OWNER,
  ]);
  await service("select public.bootstrap_platform_owner($1)", [OWNER]);
  await run(A, "select public.complete_onboarding('addon_a','Addon A')");
  await run(B, "select public.complete_onboarding('addon_b','Addon B')");
  for (let i = 0; i < 45; i++)
    titles.push(
      (
        await db.query(
          "insert into public.titles(display_title,kind,status,release_year) values($1,$2,'released',$3) returning id",
          [
            `Isolated addendum fixture ${45 - i}`,
            i % 2 ? "movie" : "anime",
            2020 + (i % 5),
          ],
        )
      ).rows[0].id,
    );
  collection = (
    await run(
      A,
      "insert into public.collections(title) values('Isolated addendum collection') returning id",
    )
  ).rows[0].id;
  await run(A, "select public.add_titles_to_collections($1,$2)", [
    [collection],
    titles.slice(0, 4),
  ]);
});
after(async () => db?.close());
test("recent searches are opt-in, bounded, private, clearable and exported only for their owner", async () => {
  await run(A, "select public.remember_discovery('search','Not stored')");
  assert.equal(
    (await run(A, "select * from public.recent_searches")).rows.length,
    0,
  );
  await run(
    A,
    "update public.recommendation_preferences set remember_searches=true where user_id=$1",
    [A],
  );
  for (let n = 0; n < 12; n++)
    await run(A, "select public.remember_discovery('search',$1)", [
      `Isolated query ${n}`,
    ]);
  assert.equal(
    (await run(A, "select * from public.recent_searches")).rows.length,
    8,
  );
  assert.equal(
    (await run(B, "select * from public.recent_searches where user_id=$1", [A]))
      .rows.length,
    0,
  );
  await assert.rejects(
    () => service("select * from public.recent_searches"),
    (e) => e.code === "42501",
  );
  const exported = (
    await run(A, "select public.export_personal_data() as data")
  ).rows[0].data;
  assert.equal(exported.recent_searches.length, 8);
  await run(
    A,
    "update public.recommendation_preferences set remember_searches=false where user_id=$1",
    [A],
  );
  assert.equal(
    (await run(A, "select * from public.recent_searches")).rows.length,
    0,
  );
});
test("recently viewed stores only canonical title IDs and times, with a 40-title limit and privacy opt-out", async () => {
  for (const id of titles)
    await run(A, "select public.remember_discovery('title',$1)", [id]);
  const rows = (await run(A, "select * from public.recent_titles")).rows;
  assert.equal(rows.length, 40);
  assert.deepEqual(Object.keys(rows[0]).sort(), [
    "title_id",
    "user_id",
    "viewed_at",
  ]);
  assert.equal(
    (await run(B, "select * from public.recent_titles")).rows.length,
    0,
  );
  assert.equal(
    (await run(OWNER, "select * from public.recent_titles")).rows.length,
    0,
  );
  await run(
    A,
    "update public.recommendation_preferences set remember_viewed=false where user_id=$1",
    [A],
  );
  assert.equal(
    (await run(A, "select * from public.recent_titles")).rows.length,
    0,
  );
  await run(A, "select public.remember_discovery('title',$1)", [titles[0]]);
  assert.equal(
    (await run(A, "select * from public.recent_titles")).rows.length,
    0,
  );
});
test("autosave compare-and-swap rejects stale versions without discarding either writer's text", async () => {
  const first = (
    await run(A, "select version from public.collections where id=$1", [
      collection,
    ])
  ).rows[0].version;
  const saved = (
    await run(A, "select public.update_collection_version($1,$2,$3) as data", [
      collection,
      first,
      { title: "First writer saved" },
    ])
  ).rows[0].data;
  assert.ok(saved.version > Number(first));
  await assert.rejects(
    () =>
      run(A, "select public.update_collection_version($1,$2,$3)", [
        collection,
        first,
        { title: "Stale writer" },
      ]),
    (e) => e.code === "40001",
  );
  assert.equal(
    (
      await run(A, "select title from public.collections where id=$1", [
        collection,
      ])
    ).rows[0].title,
    "First writer saved",
  );
  await assert.rejects(
    () =>
      run(B, "select public.update_collection_version($1,$2,$3)", [
        collection,
        saved.version,
        { title: "Spoof" },
      ]),
    (e) => e.code === "42501",
  );
  await assert.rejects(
    () =>
      run(A, "select public.update_collection_version($1,$2,$3)", [
        collection,
        saved.version,
        { owner_id: B },
      ]),
    (e) => e.code === "23514",
  );
});
test("collection view sorting and filters do not overwrite manual order; explicit saving checks version", async () => {
  const before = (
    await run(
      A,
      "select id from public.collection_items where collection_id=$1 order by position",
      [collection],
    )
  ).rows.map((r) => r.id);
  const sorted = (
    await run(
      A,
      "select * from public.collection_items_page($1,p_sort=>'title')",
      [collection],
    )
  ).rows.map((r) => r.id);
  assert.notDeepEqual(sorted, before);
  assert.deepEqual(
    (
      await run(
        A,
        "select id from public.collection_items where collection_id=$1 order by position",
        [collection],
      )
    ).rows.map((r) => r.id),
    before,
  );
  const filtered = (
    await run(
      A,
      "select * from public.collection_items_page($1,p_category=>'anime')",
      [collection],
    )
  ).rows;
  assert.equal(filtered.length, 2);
  const version = (
    await run(A, "select version from public.collections where id=$1", [
      collection,
    ])
  ).rows[0].version;
  await run(A, "select public.save_collection_order($1,$2,'title',false)", [
    collection,
    version,
  ]);
  assert.deepEqual(
    (
      await run(
        A,
        "select id from public.collection_items where collection_id=$1 order by position",
        [collection],
      )
    ).rows.map((r) => r.id),
    sorted,
  );
  await assert.rejects(
    () =>
      run(A, "select public.save_collection_order($1,$2,'category',false)", [
        collection,
        version,
      ]),
    (e) => e.code === "40001",
  );
});
test("bulk tracking and favorite actions report partial failures and never silently skip IDs", async () => {
  const missing = "30000000-0000-4000-8000-999999999999";
  const outcomes = (
    await run(
      A,
      "select public.bulk_title_actions($1,'track','completed') as data",
      [[titles[0], titles[1], missing]],
    )
  ).rows[0].data;
  assert.equal(outcomes.length, 3);
  assert.equal(outcomes.filter((r) => r.ok).length, 2);
  assert.equal(outcomes.find((r) => r.titleId === missing).ok, false);
  await run(A, "select public.bulk_title_actions($1,'favorite')", [
    titles.slice(0, 2),
  ]);
  await run(A, "select public.set_rating($1,8.3)", [titles[0]]);
  await run(A, "select public.bulk_title_actions($1,'remove')", [
    titles.slice(0, 2),
  ]);
  const states = (
    await run(A, "select public.personal_title_states($1) as data", [
      titles.slice(0, 2),
    ])
  ).rows[0].data;
  assert.ok(states.every((s) => s.tracking === null && s.favorite));
  assert.equal(states[0].rating, 8.3);
  assert.equal((await run(B, "select * from public.favorites")).rows.length, 0);
});
test("profile covers and featured collections respect ownership, publishing and block visibility", async () => {
  const path = `${A}/fixture-cover.jpg`;
  await assert.rejects(
    () =>
      run(A, "update public.profiles set cover_path=$1 where id=$2", [
        `${B}/spoof.jpg`,
        A,
      ]),
    (e) => e.code === "23514",
  );
  await assert.rejects(
    () =>
      run(
        A,
        "update public.profiles set featured_collection_id=$1 where id=$2",
        [collection, A],
      ),
    (e) => e.code === "23514",
  );
  await run(
    A,
    "update public.collections set visibility='published' where id=$1",
    [collection],
  );
  await run(
    A,
    "update public.profiles set cover_path=$1,featured_collection_id=$2 where id=$3",
    [path, collection, A],
  );
  assert.equal(
    (await run(B, "select app_private.read_avatar($1) as allowed", [path]))
      .rows[0].allowed,
    true,
  );
  await run(A, "insert into public.blocks(blocked_id) values($1)", [B]);
  assert.equal(
    (await run(B, "select app_private.read_avatar($1) as allowed", [path]))
      .rows[0].allowed,
    false,
  );
  await run(A, "delete from public.blocks where blocked_id=$1", [B]);
  await run(
    A,
    "update public.collections set visibility='private' where id=$1",
    [collection],
  );
  assert.equal(
    (
      await run(
        A,
        "select featured_collection_id from public.profiles where id=$1",
        [A],
      )
    ).rows[0].featured_collection_id,
    null,
  );
});
test("publication timestamps represent actual publication events; private collections remain absent", async () => {
  assert.ok(
    (
      await run(A, "select published_at from public.collections where id=$1", [
        collection,
      ])
    ).rows[0].published_at,
  );
  assert.equal(
    (await run(B, "select * from public.collections where id=$1", [collection]))
      .rows.length,
    0,
  );
});
test("verified relationship types do not automatically merge separate works", async () => {
  await run(
    OWNER,
    "select public.verify_title_relationship($1,$2,'franchise')",
    [titles[0], titles[1]],
  );
  const relation = (
    await run(
      null,
      "select relation,verified from public.title_relations where source_id=$1",
      [titles[0]],
    )
  ).rows[0];
  assert.deepEqual(relation, { relation: "franchise", verified: true });
  assert.equal(
    (await run(null, "select public.resolve_title($1) as id", [titles[0]]))
      .rows[0].id,
    titles[0],
  );
  await assert.rejects(
    () =>
      run(A, "select public.verify_title_relationship($1,$2,'sequel')", [
        titles[1],
        titles[2],
      ]),
    (e) => e.code === "42501",
  );
});
test("public freshness and offline permission disclose no operational errors or private user data", async () => {
  provider = (
    await db.query(
      "insert into public.metadata_providers(key,name,approved,enabled) values('tmdb','Isolated provider',true,true) returning id",
    )
  ).rows[0].id;
  await db.query(
    "insert into public.provider_title_ids(title_id,provider_id,external_id,external_type) values($1,$2,'1234','movie')",
    [titles[0], provider],
  );
  assert.equal(
    (
      await run(
        null,
        "select public.public_title_cache_allowed($1) as allowed",
        [titles[0]],
      )
    ).rows[0].allowed,
    false,
  );
  await db.query(
    "update public.metadata_providers set allow_offline_cache=true where id=$1",
    [provider],
  );
  assert.equal(
    (
      await run(
        null,
        "select public.public_title_cache_allowed($1) as allowed",
        [titles[0]],
      )
    ).rows[0].allowed,
    true,
  );
  await service("select public.record_provider_sync($1,$2,false,'timeout')", [
    titles[0],
    provider,
  ]);
  const status = (
    await run(null, "select public.catalog_freshness($1) as data", [
      [titles[0]],
    ])
  ).rows[0].data[0];
  assert.equal(status.stale, true);
  assert.deepEqual(Object.keys(status).sort(), [
    "id",
    "lastSuccessAt",
    "stale",
  ]);
  assert.equal(
    (await run(A, "select * from public.titles where id=$1", [titles[0]])).rows
      .length,
    1,
  );
});

test("provider retry claims respect backoff, exclusive leases and newer queued requests", async () => {
  const first = (
    await db.query(
      "insert into public.metadata_refresh_requests(title_id,provider_id,requested_by) values($1,$2,$3) returning id",
      [titles[0], provider, OWNER],
    )
  ).rows[0].id;
  assert.equal(
    (
      await service("select * from public.claim_provider_refreshes($1)", [
        provider,
      ])
    ).rows.length,
    0,
  );
  await db.query(
    "update public.provider_sync_state set next_attempt_at=now()-interval '1 minute' where title_id=$1 and provider_id=$2",
    [titles[0], provider],
  );
  assert.equal(
    (
      await service("select * from public.claim_provider_refreshes($1)", [
        provider,
      ])
    ).rows[0].id,
    first,
  );
  assert.equal(
    (
      await service("select * from public.claim_provider_refreshes($1)", [
        provider,
      ])
    ).rows.length,
    0,
  );
  await service("select public.record_provider_sync($1,$2,false,'timeout')", [
    titles[0],
    provider,
  ]);
  const second = (
    await db.query(
      "insert into public.metadata_refresh_requests(title_id,provider_id,requested_by) values($1,$2,$3) returning id",
      [titles[0], provider, OWNER],
    )
  ).rows[0].id;
  await db.query(
    "update public.provider_sync_state set next_attempt_at=now()-interval '1 minute' where title_id=$1 and provider_id=$2",
    [titles[0], provider],
  );
  assert.equal(
    (
      await service("select * from public.claim_provider_refreshes($1)", [
        provider,
      ])
    ).rows[0].id,
    second,
  );
  await assert.rejects(
    () =>
      run(A, "select * from public.claim_provider_refreshes($1)", [provider]),
    (e) => e.code === "42501",
  );
});
test("history retention maintenance expires old rows and returns only aggregate counts", async () => {
  await db.query(
    "insert into public.recent_searches values($1,'Expired isolated query',now()-interval '31 days')",
    [A],
  );
  await db.query(
    "insert into public.recent_titles values($1,$2,now()-interval '91 days')",
    [A, titles[0]],
  );
  const outcome = (
    await service("select public.expire_discovery_history() as data")
  ).rows[0].data;
  assert.deepEqual(outcome, { expiredSearches: 1, expiredTitleViews: 1 });
  await assert.rejects(
    () => run(A, "select public.expire_discovery_history()"),
    (e) => e.code === "42501",
  );
});
test("creator notes and moves reject concurrent stale collection versions", async () => {
  const item = (
    await run(
      A,
      "select id from public.collection_items where collection_id=$1 order by position limit 1",
      [collection],
    )
  ).rows[0].id;
  const version = (
    await run(A, "select version from public.collections where id=$1", [
      collection,
    ])
  ).rows[0].version;
  await run(
    A,
    "select public.edit_collection_item_version($1,$2,$3,'Saved note',false)",
    [collection, item, version],
  );
  await assert.rejects(
    () =>
      run(
        A,
        "select public.edit_collection_item_version($1,$2,$3,'Stale note',false)",
        [collection, item, version],
      ),
    (e) => e.code === "40001",
  );
  await assert.rejects(
    () =>
      run(
        A,
        "select public.move_collection_item_version($1,$2,$3,p_direction=>1)",
        [collection, item, version],
      ),
    (e) => e.code === "40001",
  );
  assert.equal(
    (
      await run(
        A,
        "select creator_note from public.collection_items where id=$1",
        [item],
      )
    ).rows[0].creator_note,
    "Saved note",
  );
});
test("followed-creators feed respects publication, blocking and ordinary member access", async () => {
  await run(B, "select public.set_follow($1,true)", [A]);
  await run(
    A,
    "update public.collections set visibility='published' where id=$1",
    [collection],
  );
  assert.equal(
    (await run(B, "select * from public.followed_collection_feed() ")).rows[0]
      .id,
    collection,
  );
  await run(A, "insert into public.blocks(blocked_id) values($1)", [B]);
  assert.equal(
    (await run(B, "select * from public.followed_collection_feed()")).rows
      .length,
    0,
  );
  await assert.rejects(
    () => run(null, "select * from public.followed_collection_feed()"),
    (e) => e.code === "42501",
  );
});
