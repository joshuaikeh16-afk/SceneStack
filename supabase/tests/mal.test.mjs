import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createTestDatabase } from "../../scripts/db-harness.mjs";
let db, provider;
const payload = {
  externalId: "1",
  media: "anime",
  kind: "anime",
  title: "Isolated MAL fixture",
  edition: "series",
  status: "ended",
  description: "Isolated metadata",
  year: 2000,
  popularity: null,
  poster: "https://cdn.myanimelist.net/images/anime/1/123.jpg",
  aliases: ["Isolated alias"],
  genres: ["Adventure"],
  companies: [{ id: "2", name: "Isolated studio" }],
  runtime: 24,
  releaseDate: "2000-04-01",
};
async function service(sql, args = []) {
  await db.exec("reset role");
  await db.query(
    "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)",
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
  provider = (
    await db.query(
      "insert into public.metadata_providers(key,name,approved,enabled) values('myanimelist','Isolated approved anime source',true,true) returning id",
    )
  ).rows[0].id;
});
after(async () => db?.close());
test("MAL ingest is service-only and requires the matching approved anime provider", async () => {
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('anon','public.ingest_mal_title(uuid,jsonb)','execute') ok",
      )
    ).rows[0].ok,
    false,
  );
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('authenticated','public.ingest_mal_title(uuid,jsonb)','execute') ok",
      )
    ).rows[0].ok,
    false,
  );
  await db.query(
    "update public.metadata_providers set enabled=false where id=$1",
    [provider],
  );
  await assert.rejects(
    () => service("select public.ingest_mal_title($1,$2)", [provider, payload]),
    (e) => e.code === "42501",
  );
  await db.query(
    "update public.metadata_providers set enabled=true where id=$1",
    [provider],
  );
  await assert.rejects(
    () =>
      service("select public.ingest_mal_title($1,$2)", [
        provider,
        { ...payload, media: "movie", kind: "movie" },
      ]),
    (e) => e.code === "23514",
  );
});
test("MAL imports retain stable canonical IDs, studio metadata and independent SceneStack ratings", async () => {
  const first = (
    await service("select public.ingest_mal_title($1,$2) id", [
      provider,
      payload,
    ])
  ).rows[0].id;
  const again = (
    await service("select public.ingest_mal_title($1,$2) id", [
      provider,
      { ...payload, title: "Updated fixture" },
    ])
  ).rows[0].id;
  assert.equal(first, again);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.provider_title_ids where provider_id=$1",
        [provider],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query("select runtime_minutes from public.titles where id=$1", [
        first,
      ])
    ).rows[0].runtime_minutes,
    24,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.title_companies where title_id=$1",
        [first],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select count(*)::int n from public.ratings")).rows[0]
      .n,
    0,
  );
  await db.query(
    "insert into public.metadata_provenance(title_id,field_name,source_reference) values($1,'display_title','manual_override')",
    [first],
  );
  await service("select public.ingest_mal_title($1,$2)", [
    provider,
    { ...payload, title: "Provider rewrite" },
  ]);
  assert.equal(
    (
      await db.query("select display_title from public.titles where id=$1", [
        first,
      ])
    ).rows[0].display_title,
    "Updated fixture",
  );
});
test("MAL ingest rejects foreign artwork and rolls back the entire failed import", async () => {
  await assert.rejects(
    () =>
      service("select public.ingest_mal_title($1,$2)", [
        provider,
        {
          ...payload,
          externalId: "2",
          poster: "https://evil.example/image.jpg",
        },
      ]),
    (e) => e.code === "23514",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.provider_title_ids where provider_id=$1 and external_id='2'",
        [provider],
      )
    ).rows[0].n,
    0,
  );
});
