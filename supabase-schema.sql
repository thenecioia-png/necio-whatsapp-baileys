-- Schema para Necio Bot v3.0 en Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query

-- Tabla de contactos/clientes
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  status TEXT DEFAULT 'nuevo',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count INTEGER DEFAULT 0
);

-- Tabla de conversaciones (historial completo)
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  provider TEXT,
  used_fallback BOOLEAN DEFAULT FALSE,
  used_topic TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsqueda rápida por teléfono
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at);

-- Tabla de analytics diarios
CREATE TABLE IF NOT EXISTS analytics (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
  messages INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  fallback_count INTEGER DEFAULT 0
);

-- Tabla de transacciones (contabilidad)
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ingreso', 'gasto')),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para reportes financieros
CREATE INDEX IF NOT EXISTS idx_transactions_phone ON transactions(phone);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- Políticas de seguridad RLS (opcional pero recomendado)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Permitir inserts desde el service role key (el bot)
CREATE POLICY "Allow all" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON analytics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON transactions FOR ALL USING (true) WITH CHECK (true);

-- Confirmar creación
SELECT 'Tablas creadas exitosamente' as status;
