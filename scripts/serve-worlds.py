"""Compatibility shim: the server lives in serve_worlds.py (importable name). Run either file."""
import runpy, pathlib
runpy.run_path(str(pathlib.Path(__file__).with_name('serve_worlds.py')), run_name='__main__')
