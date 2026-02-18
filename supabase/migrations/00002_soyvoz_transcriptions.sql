-- Tablas para SoyVOZ (Wispr Flow Clone)

-- Transcripciones Guardadas
CREATE TABLE transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  original_text TEXT, -- Lo que se capturó inicialmente
  refined_text TEXT,  -- El resultado después de pasar por la AI
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'refined', 'failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;

-- Usuarios pueden ver/crear sus propias transcripciones
CREATE POLICY "Users can manage their own transcriptions" ON transcriptions
  FOR ALL USING (auth.uid() = user_id);
