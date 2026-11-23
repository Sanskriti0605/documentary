import asyncio
from sqlalchemy import text
from app.database.session import async_engine, Base
import app.database.models  # Register models

async def init_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Check and migrate newly added columns in SQLite conflicts table
        try:
            columns_res = await conn.execute(text("PRAGMA table_info(conflicts)"))
            existing_cols = {row[1] for row in columns_res.fetchall()}
            
            new_columns = [
                ("subject", "VARCHAR(128)"),
                ("value_a", "VARCHAR(255)"),
                ("value_b", "VARCHAR(255)"),
                ("linked_document_id", "VARCHAR(36)"),
                ("linked_document_name", "VARCHAR(255)"),
                ("history", "TEXT DEFAULT '[]'"),
                ("updated_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
            ]
            for col_name, col_type in new_columns:
                if col_name not in existing_cols:
                    await conn.execute(text(f"ALTER TABLE conflicts ADD COLUMN {col_name} {col_type}"))
        except Exception as e:
            print(f"Schema migration notice: {e}")

if __name__ == "__main__":
    asyncio.run(init_db())
    print("Database tables initialized successfully.")
