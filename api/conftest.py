"""Makes `import main` work when pytest is run from the api folder."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
