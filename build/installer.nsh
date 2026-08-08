; WCDB requires the packaged host executable to remain electron.exe. Electron Builder's
; default process check calls its legacy GetProcessInfo macro and then kills every process
; with that generic name, which can terminate unrelated Electron applications.
;
; Keep the retry/cancel guard, but use Electron Builder's command-based process lookup and
; leave process termination to the user.
!macro customCheckAppRunning
  check_app_running:
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${if} $R0 == 0
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDCANCEL IDRETRY check_app_running
      Quit
    ${endIf}
!macroend
