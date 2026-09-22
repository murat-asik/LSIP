"""Packaged entry point for upstream forensic engines; never writes evidence."""
import sys
import multiprocessing

if __name__ == '__main__':
    multiprocessing.freeze_support()
    mode = sys.argv.pop(1) if len(sys.argv) > 1 else ''
    if mode == 'disk':
        # Partial mounted collections may contain artifacts without registry hives.
        # Preserve artifact parsing, but never invent account names in that case.
        from functools import wraps
        from dissect.target.plugins.os.windows._os import WindowsPlugin
        original_users = WindowsPlugin.users

        @wraps(original_users)
        def users_with_optional_registry(self):
            if not self.target.has_function('registry'):
                self.target.log.warning('Registry hives absent: account-name enrichment unavailable')
                return
            yield from original_users(self)

        WindowsPlugin.users = users_with_optional_registry
        from dissect.target.tools.query import main
        sys.exit(main())
    elif mode == 'memory':
        from volatility3.cli import main
        main()
    else:
        raise SystemExit('Expected disk or memory engine')
