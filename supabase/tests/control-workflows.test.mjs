import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createTestDatabase, asUser } from "../../scripts/db-harness.mjs";
const uid = (n) => `71002600-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = uid(1),
  mod = uid(2),
  a = uid(3),
  b = uid(4),
  other = uid(5);
let db, title, collection;
const run = (who, sql, args = []) => asUser(db, who, sql, args);
const denied = (work) => assert.rejects(work, (e) => e.code === "42501");
before(async () => {
  db = await createTestDatabase();
  for (let n = 1; n <= 8; n++)
    await db.query("insert into auth.users(id) values($1)", [uid(n)]);
  await db.query("select public.bootstrap_platform_owner($1)", [owner]);
  const invitation = (
    await run(
      owner,
      "select public.invite_moderator($1,'Workflow fixture appointment') id",
      [mod],
    )
  ).rows[0].id;
  await run(mod, "select public.respond_moderator_invitation($1,true)", [
    invitation,
  ]);
  title = (
    await db.query(
      "insert into public.titles(display_title,kind,status,release_year) values('Isolated legitimate workflow fixture','movie','released',2025) returning id",
    )
  ).rows[0].id;
  collection = (
    await run(
      b,
      "insert into public.collections(title,visibility) values('Isolated public collection','published') returning id",
    )
  ).rows[0].id;
});
after(async () => db?.close());
test("reports preserve public context and conversations hide reporters and internal notes", async () => {
  const report = (
    await run(
      a,
      "select public.submit_control_case('report','Collection report','Written context',null,$1,null,'{\"reason\":\"spam\"}') id",
      [collection],
    )
  ).rows[0].id;
  assert.equal(
    (await run(b, "select * from public.control_cases where id=$1", [report]))
      .rows.length,
    0,
  );
  const snapshot = (
    await run(mod, "select payload from public.control_cases where id=$1", [
      report,
    ])
  ).rows[0].payload.publicSnapshot;
  assert.equal(snapshot.title, "Isolated public collection");
  await run(
    b,
    "update public.collections set title='Edited public content' where id=$1",
    [collection],
  );
  assert.equal(
    (
      await run(mod, "select payload from public.control_cases where id=$1", [
        report,
      ])
    ).rows[0].payload.publicSnapshot.title,
    snapshot.title,
  );
  await run(
    mod,
    "select public.reply_control_case($1,'Confidential staff note',true)",
    [report],
  );
  await run(
    mod,
    "select public.reply_control_case($1,'Please clarify the written context',false)",
    [report],
  );
  assert.equal(
    (
      await run(
        a,
        "select body from public.control_messages where case_id=$1",
        [report],
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await run(
        other,
        "select body from public.control_messages where case_id=$1",
        [report],
      )
    ).rows.length,
    0,
  );
  await denied(() =>
    run(
      a,
      "select public.reply_control_case($1,'Attempted internal note',true)",
      [report],
    ),
  );
  await run(
    mod,
    "select public.review_control_case($1,'awaiting_information','Please provide more context','high',$2)",
    [report, mod],
  );
  await run(
    a,
    "select public.reply_control_case($1,'Additional written details',false)",
    [report],
  );
  assert.equal(
    (
      await run(a, "select status from public.control_cases where id=$1", [
        report,
      ])
    ).rows[0].status,
    "under_review",
  );
  await run(a, "select public.member_case_action($1,'withdraw')", [report]);
  await assert.rejects(
    () =>
      run(
        a,
        "select public.reply_control_case($1,'Cannot reply after withdrawal',false)",
        [report],
      ),
    (e) => e.code === "23514",
  );
});
test("requests deduplicate votes and cannot falsely fulfill before publication", async () => {
  const request = (
    await run(
      a,
      "select public.submit_control_case('title_request','Requested isolated title','Provider reference pending',null,null,null,'{\"category\":\"movie\",\"year\":2026}') id",
    )
  ).rows[0].id;
  await assert.rejects(
    () =>
      run(
        b,
        "select public.submit_control_case('title_request','Requested isolated title','Same title',null,null,null,'{\"category\":\"movie\",\"year\":2026}')",
      ),
    (e) => e.code === "23505",
  );
  await run(b, "select public.vote_title_request($1,true)", [request]);
  await run(b, "select public.vote_title_request($1,true)", [request]);
  assert.equal(
    (
      await run(b, "select public.browse_title_requests() rows")
    ).rows[0].rows.find((r) => r.id === request).votes,
    1,
  );
  await denied(() =>
    run(
      mod,
      "select public.review_control_case($1,'fulfilled','No catalog permission','normal',null,null,$2)",
      [request, title],
    ),
  );
  await assert.rejects(
    () =>
      run(
        owner,
        "select public.review_control_case($1,'fulfilled','Not actually published')",
        [request],
      ),
    (e) => e.code === "23514",
  );
  await run(
    owner,
    "select public.review_control_case($1,'approved_pending_publication','Import pending')",
    [request],
  );
  await run(
    owner,
    "select public.review_control_case($1,'fulfilled','The canonical title is now published','normal',null,null,$2)",
    [request, title],
  );
  assert.ok(
    (
      await run(
        b,
        "select subject from public.control_notifications where event_key=$1",
        [`request_fulfilled:${request}`],
      )
    ).rows.length,
  );
});
test("moderators can ban ordinary accounts, cannot punish administrators, and appeals remain accessible", async () => {
  await denied(() =>
    run(
      mod,
      "select public.enforce_control_account($1,'ban','Cannot punish owner','Unavailable')",
      [owner],
    ),
  );
  await denied(() =>
    run(
      mod,
      "select public.enforce_control_account($1,'ban','Cannot punish moderator','Unavailable')",
      [mod],
    ),
  );
  const action = (
    await run(
      mod,
      "select public.enforce_control_account($1,'ban','Documented violation','Your ordinary account features are restricted') id",
      [other],
    )
  ).rows[0].id;
  assert.equal(
    (await run(other, "select public.control_account_access() access")).rows[0]
      .access.active,
    false,
  );
  await denied(() =>
    run(
      other,
      "select public.submit_control_case('title_request','Blocked ordinary request','Reason',null,null,null,'{\"category\":\"movie\"}')",
    ),
  );
  const appeal = (
    await run(
      other,
      "select public.submit_control_case('appeal','Appeal the account decision','Written appeal',null,null,null,$1) id",
      [{ enforcementId: action }],
    )
  ).rows[0].id;
  await assert.rejects(
    () =>
      run(
        other,
        "select public.submit_control_case('appeal','Duplicate appeal','Duplicate',null,null,null,$1)",
        [{ enforcementId: action }],
      ),
    (e) => e.code === "23505",
  );
  await run(
    other,
    "select public.submit_control_case('support','Essential support remains accessible','Account help',null,null,null,'{}')",
  );
  await run(
    mod,
    "select public.update_control_enforcement($1,true,null,'Appeal accepted; access restored')",
    [action],
  );
  await run(
    mod,
    "select public.review_control_case($1,'accepted','The restriction was revoked')",
    [appeal],
  );
  assert.equal(
    (await run(other, "select public.control_account_access() access")).rows[0]
      .access.active,
    true,
  );
});
test("suspensions and feature restrictions expire at read/write time without a scheduler", async () => {
  const action = (
    await run(
      mod,
      "select public.enforce_control_account($1,'suspension','Temporary violation','Suspended temporarily',null,now()+interval '1 day') id",
      [other],
    )
  ).rows[0].id;
  assert.equal(
    (await run(other, "select public.control_account_access() access")).rows[0]
      .access.active,
    false,
  );
  await db.query(
    "update public.control_enforcements set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",
    [action],
  );
  assert.equal(
    (await run(other, "select public.control_account_access() access")).rows[0]
      .access.active,
    true,
  );
  const restriction = (
    await run(
      mod,
      "select public.enforce_control_account($1,'restriction','Repeated follow spam','Following is temporarily restricted','follow',now()+interval '1 day') id",
      [other],
    )
  ).rows[0].id;
  await denied(() =>
    run(other, "insert into public.follows(followed_id) values($1)", [a]),
  );
  await run(
    other,
    "select public.submit_control_case('support','Help with the restriction','Support is still accessible')",
  );
  await db.query(
    "update public.control_enforcements set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",
    [restriction],
  );
  await run(other, "insert into public.follows(followed_id) values($1)", [a]);
});
test("support conversations and satisfaction are private to the member and authorized staff", async () => {
  const ticket = (
    await run(
      a,
      "select public.submit_control_case('support','Private support request','Account issue') id",
    )
  ).rows[0].id;
  await denied(() =>
    run(
      b,
      "select public.reply_control_case($1,'Cannot access another ticket')",
      [ticket],
    ),
  );
  await run(
    mod,
    "select public.reply_control_case($1,'Saved response from support',false)",
    [ticket],
  );
  await run(
    mod,
    "select public.reply_control_case($1,'Internal investigation note',true)",
    [ticket],
  );
  await run(
    mod,
    "select public.review_control_case($1,'resolved','Issue resolved')",
    [ticket],
  );
  await run(a, "select public.member_case_action($1,'rate',5)", [ticket]);
  await run(a, "select public.member_case_action($1,'reopen')", [ticket]);
  assert.equal(
    (
      await run(
        a,
        "select status,satisfaction from public.control_cases where id=$1",
        [ticket],
      )
    ).rows[0].status,
    "reopened",
  );
  assert.equal(
    (
      await run(b, "select * from public.control_messages where case_id=$1", [
        ticket,
      ])
    ).rows.length,
    0,
  );
});
test("manual field decisions lock metadata and rollback preserves canonical identity", async () => {
  const correction = (
    await run(
      a,
      "select public.submit_control_case('correction','Correct title metadata','Two proposed fields',null,null,$1,'{\"fields\":{\"display_title\":\"Reviewed title\",\"release_year\":2024}}') id",
      [title],
    )
  ).rows[0].id;
  await denied(() =>
    run(
      mod,
      "select public.decide_correction_fields($1,'{\"display_title\":true,\"release_year\":false}','No catalog permission')",
      [correction],
    ),
  );
  await run(
    owner,
    "select public.decide_correction_fields($1,'{\"display_title\":true,\"release_year\":false}','Title approved; year not supported')",
    [correction],
  );
  assert.equal(
    (
      await run(a, "select status from public.control_cases where id=$1", [
        correction,
      ])
    ).rows[0].status,
    "partially_accepted",
  );
  assert.equal(
    (
      await run(
        a,
        "select display_title,release_year from public.titles where id=$1",
        [title],
      )
    ).rows[0].release_year,
    2025,
  );
  // A trusted provider update still cannot overwrite a manual field lock.
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await db.query(
    "update public.titles set display_title='Attempted provider overwrite' where id=$1",
    [title],
  );
  assert.equal(
    (
      await run(a, "select display_title from public.titles where id=$1", [
        title,
      ])
    ).rows[0].display_title,
    "Reviewed title",
  );
  const revision = (
    await run(
      owner,
      "select id from public.metadata_revisions where title_id=$1 order by created_at desc limit 1",
      [title],
    )
  ).rows[0].id;
  await run(
    owner,
    "select public.control_rollback_title($1,'Restoring original reviewed metadata')",
    [revision],
  );
  assert.equal(
    (
      await run(a, "select display_title from public.titles where id=$1", [
        title,
      ])
    ).rows[0].display_title,
    "Isolated legitimate workflow fixture",
  );
});
