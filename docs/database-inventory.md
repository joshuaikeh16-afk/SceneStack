# Database inventory

Generated from the local migrations with `npm run db:inventory`. This is not a hosted-project inspection.

## Migrations

- `202611230001_identity_catalog.sql`
- `202611230002_security_identity_library.sql`
- `202611230003_collections_social.sql`
- `202611230004_operations_lifecycle.sql`
- `202611230005_storage.sql`
- `202611230006_catalog_search_integrity.sql`
- `202611230007_preferences.sql`
- `202611230008_product_journeys.sql`
- `202611230009_collection_ordering.sql`
- `202611230010_onboarding_completion.sql`
- `202611230011_provider_ingestion.sql`
- `202611230012_product_integrity.sql`
- `202611230013_canonical_personal_state.sql`
- `202611230014_collection_picker.sql`
- `202611230015_creator_discovery.sql`
- `202611230016_private_discovery_profile.sql`
- `202611230017_collection_reliability.sql`
- `202611230018_catalog_detail_freshness.sql`
- `202611230019_bulk_and_exports.sql`
- `202611230020_collection_sort_versions.sql`
- `202611230021_provider_queue.sql`
- `202611230022_feed_and_retention.sql`
- `202611230023_collection_item_versions.sql`
- `202611230024_mal_ingestion.sql`

## Tables

| Schema | Table | RLS |
|---|---|---|
| app_private | platform_owner | Enabled |
| app_private | rate_limits | Enabled |
| public | account_deletions | Enabled |
| public | admin_alerts | Enabled |
| public | admin_roles | Enabled |
| public | audit_logs | Enabled |
| public | blocks | Enabled |
| public | catalog_merge_requests | Enabled |
| public | collection_favorites | Enabled |
| public | collection_imports | Enabled |
| public | collection_items | Enabled |
| public | collection_saves | Enabled |
| public | collections | Enabled |
| public | content_warnings | Enabled |
| public | countries | Enabled |
| public | data_export_requests | Enabled |
| public | favorite_genres | Enabled |
| public | favorites | Enabled |
| public | follows | Enabled |
| public | genres | Enabled |
| public | languages | Enabled |
| public | metadata_corrections | Enabled |
| public | metadata_provenance | Enabled |
| public | metadata_providers | Enabled |
| public | metadata_refresh_requests | Enabled |
| public | missing_title_requests | Enabled |
| public | moderation_actions | Enabled |
| public | notification_preferences | Enabled |
| public | notifications | Enabled |
| public | onboarding | Enabled |
| public | people | Enabled |
| public | preferred_categories | Enabled |
| public | preferred_languages | Enabled |
| public | production_companies | Enabled |
| public | profiles | Enabled |
| public | provider_sync_state | Enabled |
| public | provider_title_ids | Enabled |
| public | rating_history | Enabled |
| public | ratings | Enabled |
| public | recent_searches | Enabled |
| public | recent_titles | Enabled |
| public | recommendation_preferences | Enabled |
| public | reports | Enabled |
| public | title_artwork | Enabled |
| public | title_companies | Enabled |
| public | title_content_warnings | Enabled |
| public | title_countries | Enabled |
| public | title_credits | Enabled |
| public | title_feedback | Enabled |
| public | title_genres | Enabled |
| public | title_languages | Enabled |
| public | title_names | Enabled |
| public | title_redirects | Enabled |
| public | title_relations | Enabled |
| public | title_trailers | Enabled |
| public | titles | Enabled |
| public | tracking | Enabled |
| public | tracking_history | Enabled |

## Functions

| Signature | Security | Anonymous execute |
|---|---|---|
| `app_private.active(uuid)` | Definer; fixed empty search path | No |
| `app_private.audit_catalog_change()` | Definer; fixed empty search path | No |
| `app_private.block_event()` | Definer; fixed empty search path | No |
| `app_private.blocked(uuid,uuid)` | Definer; fixed empty search path | No |
| `app_private.can_interact(uuid)` | Definer; fixed empty search path | No |
| `app_private.can_read_collection(uuid)` | Definer; fixed empty search path | No |
| `app_private.collection_favorite_event()` | Definer; fixed empty search path | No |
| `app_private.collection_item_touch()` | Definer; fixed empty search path | No |
| `app_private.collection_version_event()` | Definer; fixed empty search path | No |
| `app_private.collection_visibility_event()` | Definer; fixed empty search path | No |
| `app_private.discovery_privacy_event()` | Definer; fixed empty search path | No |
| `app_private.emit_notification(uuid,uuid,notification_kind,uuid,text)` | Definer; fixed empty search path | No |
| `app_private.follow_event()` | Definer; fixed empty search path | No |
| `app_private.guard_collection()` | Definer; fixed empty search path | No |
| `app_private.guard_collection_interaction()` | Definer; fixed empty search path | No |
| `app_private.guard_follow()` | Definer; fixed empty search path | No |
| `app_private.guard_immutable_edges()` | Invoker | No |
| `app_private.guard_profile()` | Invoker | No |
| `app_private.has_role(admin_role)` | Definer; fixed empty search path | No |
| `app_private.ingest_tmdb_base(uuid,jsonb)` | Definer; fixed empty search path | No |
| `app_private.initialize_profile()` | Definer; fixed empty search path | No |
| `app_private.lock_user_pair(uuid,uuid)` | Definer; fixed empty search path | No |
| `app_private.member()` | Definer; fixed empty search path | No |
| `app_private.owns_collection(uuid)` | Definer; fixed empty search path | No |
| `app_private.profile_customization_guard()` | Definer; fixed empty search path | No |
| `app_private.profile_status_event()` | Definer; fixed empty search path | No |
| `app_private.protect_editorial_fields()` | Definer; fixed empty search path | No |
| `app_private.rate_limit(text,integer,interval)` | Definer; fixed empty search path | No |
| `app_private.read_avatar(text)` | Definer; fixed empty search path | Policy helper; false without active identity |
| `app_private.read_cover(text)` | Definer; fixed empty search path | Policy helper; false without active identity |
| `app_private.record_rating_history()` | Definer; fixed empty search path | No |
| `app_private.record_tracking_history()` | Definer; fixed empty search path | No |
| `app_private.require_member()` | Definer; fixed empty search path | No |
| `app_private.touch_updated_at()` | Invoker | No |
| `app_private.unfeature_collection()` | Definer; fixed empty search path | No |
| `app_private.write_avatar(text)` | Definer; fixed empty search path | Policy helper; false without active identity |
| `app_private.write_cover(text)` | Definer; fixed empty search path | Policy helper; false without active identity |
| `add_collection_item(uuid,uuid,text)` | Definer; fixed empty search path | No |
| `add_titles_to_collections(uuid[],uuid[])` | Definer; fixed empty search path | No |
| `admin_account_action(uuid,moderation_kind,text,timestamp with time zone)` | Definer; fixed empty search path | No |
| `admin_profiles(text,integer,integer)` | Definer; fixed empty search path | No |
| `admin_summary()` | Definer; fixed empty search path | No |
| `blocked_accounts(integer,integer)` | Definer; fixed empty search path | No |
| `bootstrap_platform_owner(uuid)` | Definer; fixed empty search path | No |
| `browse_catalog(text,entertainment_kind,integer,uuid,text,text,numeric,text,catalog_status,integer,integer)` | Invoker | Yes; public catalog only |
| `bulk_title_actions(uuid[],text,tracking_status)` | Definer; fixed empty search path | No |
| `catalog_edit_title(uuid,text,entertainment_kind,text,integer,text,text)` | Definer; fixed empty search path | No |
| `catalog_freshness(uuid[])` | Definer; fixed empty search path | Yes; public catalog only |
| `catalog_title_extras(uuid)` | Invoker | Yes; public catalog only |
| `change_personal_title(uuid,text,tracking_status,numeric,boolean,text)` | Definer; fixed empty search path | No |
| `claim_account_purge(uuid)` | Definer; fixed empty search path | No |
| `claim_provider_refreshes(uuid,integer)` | Definer; fixed empty search path | No |
| `collection_card_data(uuid[])` | Invoker | No |
| `collection_items_page(uuid,text,entertainment_kind,text,integer,integer)` | Invoker | No |
| `collection_memberships(uuid[],uuid[])` | Invoker | No |
| `collection_metrics(uuid)` | Definer; fixed empty search path | No |
| `community_rating(uuid)` | Definer; fixed empty search path | Yes; public catalog only |
| `complete_onboarding(text,text,entertainment_kind[],uuid[],uuid[])` | Definer; fixed empty search path | No |
| `create_collection_with_titles(uuid,text,text,collection_visibility,boolean,uuid[])` | Definer; fixed empty search path | No |
| `edit_collection_item_version(uuid,uuid,bigint,text,boolean)` | Definer; fixed empty search path | No |
| `expire_discovery_history()` | Definer; fixed empty search path | No |
| `export_personal_data()` | Definer; fixed empty search path | No |
| `follow_counts(uuid)` | Definer; fixed empty search path | No |
| `followed_collection_feed(integer,integer)` | Invoker | No |
| `import_collection(uuid,text)` | Definer; fixed empty search path | No |
| `import_collection_once(uuid,uuid)` | Definer; fixed empty search path | No |
| `included_collection_titles(uuid,uuid[])` | Invoker | No |
| `ingest_mal_title(uuid,jsonb)` | Definer; fixed empty search path | No |
| `ingest_tmdb_title(uuid,jsonb)` | Definer; fixed empty search path | No |
| `library_collections(text,text,text,integer,integer)` | Invoker | No |
| `library_titles(text,tracking_status,text,text,integer,integer)` | Invoker | No |
| `manage_admin_role(uuid,uuid,admin_role,boolean)` | Definer; fixed empty search path | No |
| `mark_all_notifications_read()` | Definer; fixed empty search path | No |
| `moderate_report(uuid,moderation_kind,text,timestamp with time zone)` | Definer; fixed empty search path | No |
| `move_collection_item(uuid,uuid,uuid,integer)` | Definer; fixed empty search path | No |
| `move_collection_item_version(uuid,uuid,bigint,uuid,integer)` | Definer; fixed empty search path | No |
| `my_library_counts()` | Invoker | No |
| `personal_title_states(uuid[])` | Definer; fixed empty search path | No |
| `propose_catalog_merge(uuid,uuid,text)` | Definer; fixed empty search path | No |
| `public_title_cache_allowed(uuid)` | Definer; fixed empty search path | Yes; public catalog only |
| `recommend_title_ids(integer)` | Definer; fixed empty search path | No |
| `record_provider_sync(uuid,uuid,boolean,text)` | Definer; fixed empty search path | No |
| `recover_account()` | Definer; fixed empty search path | No |
| `release_expired_suspensions()` | Definer; fixed empty search path | No |
| `remember_discovery(text,text)` | Definer; fixed empty search path | No |
| `reorder_collection_items(uuid,uuid[])` | Definer; fixed empty search path | No |
| `request_account_deletion()` | Definer; fixed empty search path | No |
| `request_data_export(text)` | Definer; fixed empty search path | No |
| `request_metadata_refresh(uuid,uuid)` | Definer; fixed empty search path | No |
| `resolve_title(uuid)` | Invoker | Yes; public catalog only |
| `review_catalog_submission(text,uuid,boolean,text,uuid)` | Definer; fixed empty search path | No |
| `save_collection_order(uuid,bigint,text,boolean)` | Definer; fixed empty search path | No |
| `save_onboarding_progress(integer,text,text)` | Definer; fixed empty search path | No |
| `save_onboarding_starters(uuid[])` | Definer; fixed empty search path | No |
| `search_catalog(text,entertainment_kind,integer,uuid,text,text,numeric,text,integer,integer)` | Invoker | No |
| `search_creators(text,integer,integer)` | Invoker | No |
| `set_collection_interaction(uuid,text,boolean)` | Definer; fixed empty search path | No |
| `set_discovery_preferences(entertainment_kind[],uuid[],text[])` | Definer; fixed empty search path | No |
| `set_favorite(uuid,boolean)` | Definer; fixed empty search path | No |
| `set_follow(uuid,boolean)` | Definer; fixed empty search path | No |
| `set_rating(uuid,numeric)` | Definer; fixed empty search path | No |
| `set_title_feedback(uuid,text)` | Definer; fixed empty search path | No |
| `set_tracking(uuid,tracking_status)` | Definer; fixed empty search path | No |
| `sort_collection_items(uuid,text,boolean)` | Definer; fixed empty search path | No |
| `submit_missing_title(text,entertainment_kind,text)` | Definer; fixed empty search path | No |
| `submit_report(uuid,uuid,text,text)` | Definer; fixed empty search path | No |
| `suggest_correction(uuid,text,text,text)` | Definer; fixed empty search path | No |
| `title_card_data(uuid[])` | Invoker | Yes; public catalog only |
| `transfer_platform_owner(uuid,uuid)` | Definer; fixed empty search path | No |
| `update_collection_version(uuid,bigint,jsonb)` | Definer; fixed empty search path | No |
| `username_available(text)` | Definer; fixed empty search path | No |
| `verify_title_relationship(uuid,uuid,text)` | Definer; fixed empty search path | No |

## Policies

| Table | Policy | Operation | Roles | Mode |
|---|---|---|---|---|
| public.account_deletions | deletion_owner_read | SELECT | authenticated | PERMISSIVE |
| public.admin_alerts | catalog_operations_read | SELECT | authenticated | PERMISSIVE |
| public.admin_roles | roles_self_read | SELECT | authenticated | PERMISSIVE |
| public.audit_logs | audit_read | SELECT | authenticated | PERMISSIVE |
| public.blocks | block_delete | DELETE | authenticated | PERMISSIVE |
| public.blocks | block_insert | INSERT | authenticated | PERMISSIVE |
| public.blocks | block_read | SELECT | authenticated | PERMISSIVE |
| public.catalog_merge_requests | merge_read | SELECT | authenticated | PERMISSIVE |
| public.collection_favorites | interaction_delete | DELETE | authenticated | PERMISSIVE |
| public.collection_favorites | interaction_insert | INSERT | authenticated | PERMISSIVE |
| public.collection_favorites | interaction_read | SELECT | authenticated | PERMISSIVE |
| public.collection_imports | own_read | SELECT | authenticated | PERMISSIVE |
| public.collection_items | item_delete | DELETE | authenticated | PERMISSIVE |
| public.collection_items | item_edit | UPDATE | authenticated | PERMISSIVE |
| public.collection_items | item_read | SELECT | authenticated | PERMISSIVE |
| public.collection_saves | interaction_delete | DELETE | authenticated | PERMISSIVE |
| public.collection_saves | interaction_insert | INSERT | authenticated | PERMISSIVE |
| public.collection_saves | interaction_read | SELECT | authenticated | PERMISSIVE |
| public.collections | collection_create | INSERT | authenticated | PERMISSIVE |
| public.collections | collection_delete | DELETE | authenticated | PERMISSIVE |
| public.collections | collection_edit | UPDATE | authenticated | PERMISSIVE |
| public.collections | collection_read | SELECT | authenticated | PERMISSIVE |
| public.content_warnings | catalog_read | SELECT | anon, authenticated | PERMISSIVE |
| public.countries | catalog_read | SELECT | anon, authenticated | PERMISSIVE |
| public.data_export_requests | own_read | SELECT | authenticated | PERMISSIVE |
| public.favorite_genres | own_delete | DELETE | authenticated | PERMISSIVE |
| public.favorite_genres | own_insert | INSERT | authenticated | PERMISSIVE |
| public.favorite_genres | own_read | SELECT | authenticated | PERMISSIVE |
| public.favorites | own_delete | DELETE | authenticated | PERMISSIVE |
| public.favorites | own_insert | INSERT | authenticated | PERMISSIVE |
| public.favorites | own_read | SELECT | authenticated | PERMISSIVE |
| public.follows | follow_delete | DELETE | authenticated | PERMISSIVE |
| public.follows | follow_insert | INSERT | authenticated | PERMISSIVE |
| public.follows | follow_read | SELECT | authenticated | PERMISSIVE |
| public.genres | catalog_read | SELECT | anon, authenticated | PERMISSIVE |
| public.languages | catalog_read | SELECT | anon, authenticated | PERMISSIVE |
| public.metadata_corrections | correction_read | SELECT | authenticated | PERMISSIVE |
| public.metadata_provenance | provenance_read | SELECT | anon, authenticated | PERMISSIVE |
| public.metadata_providers | provider_attribution_read | SELECT | anon, authenticated | PERMISSIVE |
| public.metadata_refresh_requests | catalog_operations_read | SELECT | authenticated | PERMISSIVE |
| public.missing_title_requests | missing_read | SELECT | authenticated | PERMISSIVE |
| public.moderation_actions | actions_read | SELECT | authenticated | PERMISSIVE |
| public.notification_preferences | notification_preferences_update | UPDATE | authenticated | PERMISSIVE |
| public.notification_preferences | own_read | SELECT | authenticated | PERMISSIVE |
| public.notifications | notification_read | SELECT | authenticated | PERMISSIVE |
| public.notifications | notification_update | UPDATE | authenticated | PERMISSIVE |
| public.onboarding | own_read | SELECT | authenticated | PERMISSIVE |
| public.people | catalog_read | SELECT | anon, authenticated | PERMISSIVE |
| public.preferred_categories | own_delete | DELETE | authenticated | PERMISSIVE |
| public.preferred_categories | own_insert | INSERT | authenticated | PERMISSIVE |
| public.preferred_categories | own_read | SELECT | authenticated | PERMISSIVE |
| public.preferred_languages | own_delete | DELETE | authenticated | PERMISSIVE |
| public.preferred_languages | own_insert | INSERT | authenticated | PERMISSIVE |
| public.preferred_languages | own_read | SELECT | authenticated | PERMISSIVE |
| public.production_companies | production_companies_read | SELECT | anon, authenticated | PERMISSIVE |
| public.profiles | profiles_read | SELECT | authenticated | PERMISSIVE |
| public.profiles | profiles_update | UPDATE | authenticated | PERMISSIVE |
| public.provider_sync_state | catalog_operations_read | SELECT | authenticated | PERMISSIVE |
| public.provider_title_ids | external_reference_read | SELECT | anon, authenticated | PERMISSIVE |
| public.rating_history | own_read | SELECT | authenticated | PERMISSIVE |
| public.ratings | own_read | SELECT | authenticated | PERMISSIVE |
| public.ratings | ratings_delete | DELETE | authenticated | PERMISSIVE |
| public.recent_searches | recent_searches_delete | DELETE | authenticated | PERMISSIVE |
| public.recent_searches | recent_searches_owner | SELECT | authenticated | PERMISSIVE |
| public.recent_titles | recent_titles_delete | DELETE | authenticated | PERMISSIVE |
| public.recent_titles | recent_titles_owner | SELECT | authenticated | PERMISSIVE |
| public.recommendation_preferences | own_read | SELECT | authenticated | PERMISSIVE |
| public.recommendation_preferences | recommendation_preferences_update | UPDATE | authenticated | PERMISSIVE |
| public.reports | reports_read | SELECT | authenticated | PERMISSIVE |
| public.title_artwork | catalog_read | SELECT | anon, authenticated | PERMISSIVE |
| public.title_companies | title_companies_read | SELECT | anon, authenticated | PERMISSIVE |
| public.title_content_warnings | catalog_read | SELECT | anon, authenticated | PERMISSIVE |
| public.title_countries | catalog_read | SELECT | anon, authenticated | PERMISSIVE |
| public.title_credits | catalog_read | SELECT | anon, authenticated | PERMISSIVE |
| public.title_feedback | feedback_delete | DELETE | authenticated | PERMISSIVE |
| public.title_feedback | feedback_read | SELECT | authenticated | PERMISSIVE |
| public.title_genres | catalog_read | SELECT | anon, authenticated | PERMISSIVE |
| public.title_languages | catalog_read | SELECT | anon, authenticated | PERMISSIVE |
| public.title_names | catalog_read | SELECT | anon, authenticated | PERMISSIVE |
| public.title_redirects | catalog_read | SELECT | anon, authenticated | PERMISSIVE |
| public.title_relations | catalog_read | SELECT | anon, authenticated | PERMISSIVE |
| public.title_trailers | catalog_read | SELECT | anon, authenticated | PERMISSIVE |
| public.titles | catalog_read | SELECT | anon, authenticated | PERMISSIVE |
| public.tracking | own_read | SELECT | authenticated | PERMISSIVE |
| public.tracking | tracking_delete | DELETE | authenticated | PERMISSIVE |
| public.tracking_history | own_read | SELECT | authenticated | PERMISSIVE |
| storage.objects | scenestack_asset_delete | DELETE | authenticated | PERMISSIVE |
| storage.objects | scenestack_asset_insert | INSERT | authenticated | PERMISSIVE |
| storage.objects | scenestack_asset_read | SELECT | authenticated | PERMISSIVE |
| storage.objects | scenestack_asset_update | UPDATE | authenticated | PERMISSIVE |
| storage.objects | scenestack_delete_boundary | DELETE | anon, authenticated | RESTRICTIVE |
| storage.objects | scenestack_insert_boundary | INSERT | anon, authenticated | RESTRICTIVE |
| storage.objects | scenestack_read_boundary | SELECT | anon, authenticated | RESTRICTIVE |
| storage.objects | scenestack_update_boundary | UPDATE | anon, authenticated | RESTRICTIVE |
