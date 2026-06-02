CREATE POLICY "Public read pix-qrcodes"
ON storage.objects FOR SELECT
USING (bucket_id = 'pix-qrcodes');

CREATE POLICY "Service role manage pix-qrcodes"
ON storage.objects FOR ALL
USING (bucket_id = 'pix-qrcodes' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'pix-qrcodes' AND auth.role() = 'service_role');