from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../../apps/web/.env.local"), extra="ignore")

    supabase_url: str | None = None
    next_public_supabase_url: str | None = None
    supabase_secret_key: str | None = None
    processor_shared_secret: str | None = None
    parser_pdf: str = "native"
    max_facts: int = 2000

    @property
    def resolved_supabase_url(self) -> str:
        url = self.supabase_url or self.next_public_supabase_url
        if not url:
            raise RuntimeError("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.")
        return url

    @property
    def resolved_secret_key(self) -> str:
        if not self.supabase_secret_key:
            raise RuntimeError("SUPABASE_SECRET_KEY is required for staging writes.")
        return self.supabase_secret_key


settings = Settings()
