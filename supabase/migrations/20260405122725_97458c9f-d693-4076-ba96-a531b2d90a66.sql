INSERT INTO storage.buckets (id, name, public) VALUES ('pix-qrcodes', 'pix-qrcodes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read pix-qrcodes" ON storage.objects FOR SELECT USING (bucket_id = 'pix-qrcodes');
CREATE POLICY "Service role upload pix-qrcodes" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pix-qrcodes' AND auth.role() = 'service_role');
