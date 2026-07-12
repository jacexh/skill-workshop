Inspect the supplied workspace and design verification for this change. Do not
edit files.

The seven-line shell entrypoint changes the application config path from
`/etc/app/old.yaml` to `/etc/app/new.yaml`. The image build is intended to copy
the new file, and the deployment platform supports manifest dry-run. Decide what
evidence to collect and what new tests, if any, are justified.
