from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Supabase
    supabase_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    database_url: str  # pooler URL, port 6543 — used by the app
    database_direct_url: str  # direct URL, port 5432 — used by Alembic only

    # AWS S3
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str = "us-east-1"
    s3_bucket_name: str

    # LLM
    llm_provider: str = "gemini"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""

    # Skribby (Meeting Bot API)
    skribby_api_key: str

    # ElevenLabs (stretch goal — not required for MVP)
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = ""

    # GitHub OAuth
    github_client_id: str
    github_client_secret: str
    github_redirect_uri: str

    # Jira OAuth
    jira_client_id: str
    jira_client_secret: str
    jira_redirect_uri: str

    # Frontend URL (for OAuth redirects back to the UI)
    frontend_url: str = "http://localhost:3000"


settings = Settings()
