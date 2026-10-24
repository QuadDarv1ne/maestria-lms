# Stepik course exporter

This script exports a Stepik course to Markdown files and downloads its lesson
attachments. It does not import the course into the Maestria database.

## Requirements

Python 3.10 or newer. The script uses only the Python standard library.

Create an API client in Stepik and provide its credentials as environment
variables. In PowerShell:

```powershell
$env:STEPIK_CLIENT_ID = "your-client-id"
$env:STEPIK_CLIENT_SECRET = "your-client-secret"
py scripts\stepik-import\stepik_dump.py
```

The default course ID is `207061`. Override it with `--course-id` or
`STEPIK_COURSE_ID`. By default, files are written to
`downloads/stepik_course_<course-id>` in the repository. Set `--output-dir` or
`STEPIK_OUTPUT_DIR` to use a different location.

For example:

```powershell
py scripts\stepik-import\stepik_dump.py --course-id 123456 --output-dir D:\course-dumps\stepik
```
