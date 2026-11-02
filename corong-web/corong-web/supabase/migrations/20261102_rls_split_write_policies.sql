-- Audit performa (2 Nov 2026): pecah policy ALL (yang ikut mencakup SELECT) jadi INSERT/UPDATE/DELETE.
-- Ekspresi tetap sama persis, jadi akses tidak berubah; hanya menghilangkan policy SELECT ganda.

-- ad_budgets (USING = WITH CHECK)
drop policy if exists ad_budgets_write on public.ad_budgets;
create policy ad_budgets_insert on public.ad_budgets for insert to public
  with check ((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT my_role() AS my_role) = ANY (ARRAY['owner'::text, 'manager'::text]))));
create policy ad_budgets_update on public.ad_budgets for update to public
  using ((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT my_role() AS my_role) = ANY (ARRAY['owner'::text, 'manager'::text]))))
  with check ((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT my_role() AS my_role) = ANY (ARRAY['owner'::text, 'manager'::text]))));
create policy ad_budgets_delete on public.ad_budgets for delete to public
  using ((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT my_role() AS my_role) = ANY (ARRAY['owner'::text, 'manager'::text]))));

-- org_product_catalog (USING = WITH CHECK)
drop policy if exists org_product_catalog_write on public.org_product_catalog;
create policy org_product_catalog_insert on public.org_product_catalog for insert to public
  with check ((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND (my_role() = ANY (ARRAY['owner'::text, 'manager'::text])) AND (EXISTS ( SELECT 1 FROM organizations o WHERE ((o.id = org_product_catalog.org_id) AND (o.plan = 'enterprise'::text)))));
create policy org_product_catalog_update on public.org_product_catalog for update to public
  using ((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND (my_role() = ANY (ARRAY['owner'::text, 'manager'::text])) AND (EXISTS ( SELECT 1 FROM organizations o WHERE ((o.id = org_product_catalog.org_id) AND (o.plan = 'enterprise'::text)))))
  with check ((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND (my_role() = ANY (ARRAY['owner'::text, 'manager'::text])) AND (EXISTS ( SELECT 1 FROM organizations o WHERE ((o.id = org_product_catalog.org_id) AND (o.plan = 'enterprise'::text)))));
create policy org_product_catalog_delete on public.org_product_catalog for delete to public
  using ((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND (my_role() = ANY (ARRAY['owner'::text, 'manager'::text])) AND (EXISTS ( SELECT 1 FROM organizations o WHERE ((o.id = org_product_catalog.org_id) AND (o.plan = 'enterprise'::text)))));

-- sales_targets (USING beda dengan WITH CHECK)
drop policy if exists sales_targets_write on public.sales_targets;
create policy sales_targets_insert on public.sales_targets for insert to public
  with check ((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND (my_role() = ANY (ARRAY['owner'::text, 'manager'::text])) AND (EXISTS ( SELECT 1 FROM organizations o WHERE ((o.id = sales_targets.org_id) AND (o.plan = 'enterprise'::text)))));
create policy sales_targets_update on public.sales_targets for update to public
  using ((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND (my_role() = ANY (ARRAY['owner'::text, 'manager'::text])))
  with check ((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND (my_role() = ANY (ARRAY['owner'::text, 'manager'::text])) AND (EXISTS ( SELECT 1 FROM organizations o WHERE ((o.id = sales_targets.org_id) AND (o.plan = 'enterprise'::text)))));
create policy sales_targets_delete on public.sales_targets for delete to public
  using ((org_id IN ( SELECT my_org_ids() AS my_org_ids)) AND (my_role() = ANY (ARRAY['owner'::text, 'manager'::text])));

-- stages (USING = WITH CHECK)
drop policy if exists stages_owner_write on public.stages;
create policy stages_insert on public.stages for insert to public
  with check (org_id IN ( SELECT o.id FROM organizations o WHERE (o.owner_user_id = ( SELECT auth.uid() AS uid))));
create policy stages_update on public.stages for update to public
  using (org_id IN ( SELECT o.id FROM organizations o WHERE (o.owner_user_id = ( SELECT auth.uid() AS uid))))
  with check (org_id IN ( SELECT o.id FROM organizations o WHERE (o.owner_user_id = ( SELECT auth.uid() AS uid))));
create policy stages_delete on public.stages for delete to public
  using (org_id IN ( SELECT o.id FROM organizations o WHERE (o.owner_user_id = ( SELECT auth.uid() AS uid))));
