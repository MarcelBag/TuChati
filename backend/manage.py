#backend/manage.py
#!/usr/bin/env python
import os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE','tuchati_config.settings')
from django.core.management import execute_from_command_line
execute_from_command_line(sys.argv)
