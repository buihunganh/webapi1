import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client


def _load_env() -> None:
    base_dir = Path(__file__).resolve().parent.parent
    candidates = [base_dir.parent / '.env', base_dir / '.env']
    for env_path in candidates:
        if env_path.exists():
            load_dotenv(env_path, override=True)
            return


_load_env()

# Cached Supabase client singleton - avoid creating new connection per request
_supabase_client: Client | None = None


def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_PUBLISHABLE_KEY')

    if not supabase_url or not supabase_key:
        raise RuntimeError('Missing SUPABASE_URL or SUPABASE key in .env')

    _supabase_client = create_client(supabase_url, supabase_key)
    return _supabase_client
