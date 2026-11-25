import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createTestDatabase, asUser } from "../../scripts/db-harness.mjs";
const id = (n) => `71002500-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1),
  member = id(2);
let db;
const run = (who, sql, args = []) => asUser(db, who, sql, args);
const forbidden = (work) => assert.rejects(work, (e) => e.code === "42501");
before(async () => {
  db = await createTestDatabase();
  for (let n = 1; n <= 14; n++)
    await db.query(
      'insert into auth.users(id,raw_user_meta_data) values($1,\'{"role":"super_admin"}\')',
      [id(n)],
    );
  await db.query("select public.bootstrap_platform_owner($1)", [owner]);
});
after(async () => db?.close());
test("ordinary accounts and forged metadata cannot administer or appoint", async () => {
  assert.equal(
    (await run(member, "select public.control_identity() value")).rows[0].value,
    null,
  );
  await forbidden(() =>
    run(member, "select public.invite_moderator($1,'Escalation')", [id(3)]),
  );
  await forbidden(() =>
    run(
      member,
      "insert into public.admin_roles(user_id,role) values($1,'super_admin')",
      [member],
    ),
  );
  await forbidden(() =>
    run(owner, "select public.manage_admin_role($1,$2,'moderator',true)", [
      owner,
      member,
    ]),
  );
});
test("single immutable owner and retired catalog editor cannot be assigned", async () => {
  await assert.rejects(() =>
    db.query(
      "insert into public.admin_roles(user_id,role) values($1,'super_admin')",
      [member],
    ),
  );
  await assert.rejects(
    () =>
      db.query(
        "insert into public.admin_roles(user_id,role) values($1,'catalog_editor')",
        [member],
      ),
    (e) => e.code === "23514",
  );
  await forbidden(() =>
    db.query("delete from public.admin_roles where user_id=$1", [owner]),
  );
  await forbidden(() =>
    db.query(
      "update public.admin_roles set suspended_at=now() where user_id=$1",
      [owner],
    ),
  );
  await forbidden(() =>
    run(
      owner,
      "select public.manage_moderator($1,'remove','Must preserve owner')",
      [owner],
    ),
  );
  assert.equal(
    (await run(owner, "select public.control_identity() value")).rows[0].value
      .role,
    "super_admin",
  );
});
test("invitations are private, expire, can be declined/cancelled, and prevent duplicates", async () => {
  const invite = async (who) =>
    (
      await run(
        owner,
        "select public.invite_moderator($1,'Reviewed appointment') id",
        [who],
      )
    ).rows[0].id;
  let invitation = await invite(member);
  assert.equal(
    (await run(id(3), "select * from public.admin_invitations")).rows.length,
    0,
  );
  await assert.rejects(
    () =>
      run(id(3), "select public.respond_moderator_invitation($1,true)", [
        invitation,
      ]),
    (e) => e.code === "23514",
  );
  await assert.rejects(
    () => invite(member),
    (e) => e.code === "23505",
  );
  await run(member, "select public.respond_moderator_invitation($1,false)", [
    invitation,
  ]);
  invitation = await invite(member);
  await run(
    owner,
    "select public.manage_moderator($1,'cancel_invitation','Cancelled appointment')",
    [member],
  );
  await assert.rejects(
    () =>
      run(member, "select public.respond_moderator_invitation($1,true)", [
        invitation,
      ]),
    (e) => e.code === "23514",
  );
  invitation = await invite(member);
  await db.query(
    "update public.admin_invitations set created_at=now()-interval '8 days',expires_at=now()-interval '1 day' where id=$1",
    [invitation],
  );
  await assert.rejects(
    () =>
      run(member, "select public.respond_moderator_invitation($1,true)", [
        invitation,
      ]),
    (e) => e.code === "23514",
  );
  await invite(member); // expired reservation is reclaimed transactionally
  await run(
    owner,
    "select public.manage_moderator($1,'cancel_invitation','Clear test reservation')",
    [member],
  );
});
test("five positions include pending and suspended moderators; revocation is immediate", async () => {
  for (let n = 3; n <= 6; n++)
    await run(owner, "select public.invite_moderator($1,'Reserve position')", [
      id(n),
    ]);
  // Racing requests to the last position are serialized by the shared lock.
  // PGlite queues one connection; the database trigger is the invariant under test.
  const racing = await Promise.allSettled([
    db.query("select public.invite_moderator($1,'Last position')", [id(7)]),
    db.query("select public.invite_moderator($1,'Last position')", [id(8)]),
  ]);
  assert.equal(racing.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(racing.filter((r) => r.status === "rejected").length, 1);
  await assert.rejects(
    () =>
      run(owner, "select public.invite_moderator($1,'Exceeds capacity')", [
        id(9),
      ]),
    (e) => e.code === "23514",
  );
  const invitation = (
    await run(
      id(3),
      "select id from public.admin_invitations where invited_user_id=$1 and status='pending'",
      [id(3)],
    )
  ).rows[0].id;
  await run(id(3), "select public.respond_moderator_invitation($1,true)", [
    invitation,
  ]);
  assert.equal(
    (await run(id(3), "select public.control_identity() value")).rows[0].value
      .role,
    "moderator",
  );
  await forbidden(() =>
    run(id(3), "select public.invite_moderator($1,'Cannot appoint')", [id(9)]),
  );
  await run(
    owner,
    "select public.manage_moderator($1,'suspend','Temporary team access suspension')",
    [id(3)],
  );
  assert.equal(
    (await run(id(3), "select public.control_identity() value")).rows[0].value,
    null,
  );
  await assert.rejects(
    () =>
      run(
        owner,
        "select public.invite_moderator($1,'Suspended position remains occupied')",
        [id(9)],
      ),
    (e) => e.code === "23514",
  );
  await run(
    owner,
    "select public.manage_moderator($1,'restore','Access restored')",
    [id(3)],
  );
  assert.equal(
    (await run(id(3), "select public.control_identity() value")).rows[0].value
      .role,
    "moderator",
  );
  await run(
    owner,
    "select public.manage_moderator($1,'remove','Appointment ended')",
    [id(3)],
  );
  assert.equal(
    (await run(id(3), "select public.control_identity() value")).rows[0].value,
    null,
  );
  assert.equal(
    (await run(id(3), "select id from public.profiles where id=$1", [id(3)]))
      .rows.length,
    1,
  );
  await run(owner, "select public.invite_moderator($1,'Freed position')", [
    id(9),
  ]);
  const logs = await run(
    owner,
    "select action from public.audit_logs where action like 'moderator_%'",
  );
  for (const action of [
    "moderator_invited",
    "moderator_appointed",
    "moderator_suspend",
    "moderator_restore",
    "moderator_remove",
  ])
    assert.ok(
      logs.rows.some((r) => r.action === action),
      action,
    );
});
