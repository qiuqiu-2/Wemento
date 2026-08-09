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

; A unified data directory must stay writable by the signed-in Windows user.
; Force fresh assisted installs into current-user mode while keeping upgrades of
; an existing machine-wide installation discoverable by electron-builder.
!macro customInstallMode
  !ifndef BUILD_UNINSTALLER
    StrCpy $isForceCurrentInstall "1"
  !endif
!macroend

; electron-builder normally removes $INSTDIR recursively during both upgrades
; and uninstall. Preserve the application-owned data directory by moving it to
; a same-volume sibling while application files are replaced. An explicit
; --delete-app-data invocation still removes everything.
!macro customRemoveFiles
  ${GetParameters} $R7
  ClearErrors
  ${GetOptions} $R7 "--delete-app-data" $R6
  ${IfNot} ${Errors}
    RMDir /r "$INSTDIR"
  ${Else}
    StrCpy $R8 "$INSTDIR.wemento-data-backup"
    StrCpy $R9 "0"

    ${If} ${FileExists} "$R8\*.*"
      ${If} ${FileExists} "$INSTDIR\data\*.*"
        MessageBox MB_OK|MB_ICONSTOP "Wemento cannot continue because both the data directory and its recovery backup exist:$\r$\n$INSTDIR\data$\r$\n$R8" /SD IDOK
        Abort
      ${Else}
        StrCpy $R9 "1"
      ${EndIf}
    ${ElseIf} ${FileExists} "$INSTDIR\data\*.*"
      RMDir "$R8"
      ClearErrors
      Rename "$INSTDIR\data" "$R8"
      ${If} ${Errors}
        MessageBox MB_OK|MB_ICONSTOP "Wemento cannot preserve the data directory. Close all related processes and retry:$\r$\n$INSTDIR\data" /SD IDOK
        Abort
      ${EndIf}
      StrCpy $R9 "1"
    ${EndIf}

    StrCpy $R5 "0"
    ClearErrors
    RMDir /r "$INSTDIR"
    ${If} ${Errors}
      StrCpy $R5 "1"
    ${EndIf}

    ${If} $R9 == "1"
      CreateDirectory "$INSTDIR"
      ClearErrors
      Rename "$R8" "$INSTDIR\data"
      ${If} ${Errors}
        MessageBox MB_OK|MB_ICONSTOP "Wemento data is safe in the recovery directory, but could not be restored automatically:$\r$\n$R8" /SD IDOK
        Abort
      ${EndIf}
    ${EndIf}

    ${If} $R5 == "1"
      MessageBox MB_OK|MB_ICONSTOP "Wemento data was restored, but some application files are still in use. Close related processes and retry." /SD IDOK
      Abort
    ${EndIf}
  ${EndIf}
!macroend
