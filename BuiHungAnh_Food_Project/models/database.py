import os
import pyodbc

DATABASE_NAME = os.getenv("DB_NAME", "BuiHungAnhFood_v3")
DRIVER_NAME = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")

# Co the override bang DB_SERVER, neu khong se thu cac instance pho bien tren may
SERVER_CANDIDATES = [
    os.getenv("DB_SERVER"),
    r"localhost\SQLEXPRESS",
    r"localhost\SQLEXPRESS01",
    "localhost",
    r"(localdb)\MSSQLLocalDB",
]


def _build_connection_string(server_name: str) -> str:
    return (
        f"DRIVER={{{DRIVER_NAME}}};"
        f"SERVER={server_name};"
        f"DATABASE={DATABASE_NAME};"
        "Trusted_Connection=yes;"
        "TrustServerCertificate=yes;"
        "Connect Timeout=5;"
    )


def get_connection():
    """Tra ve ket noi toi SQL Server voi fallback theo nhieu server instance."""
    last_error = None

    for server in [s for s in SERVER_CANDIDATES if s]:
        try:
            connection_string = _build_connection_string(server)
            return pyodbc.connect(connection_string, timeout=5)
        except pyodbc.Error as err:
            last_error = err

    raise pyodbc.OperationalError(
        "Unable to connect to SQL Server. Checked servers: "
        + ", ".join([s for s in SERVER_CANDIDATES if s])
    ) from last_error
