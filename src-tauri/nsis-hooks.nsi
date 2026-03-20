; NetworkTool NSIS Uninstall Hooks
; Cleans up application data on uninstall

!macro NSIS_HOOK_PREINSTALL
  ; Kill any running instance before installing/updating
  nsExec::ExecToLog 'taskkill /F /IM "NetworkTool.exe"'
  Sleep 500
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Nothing extra needed after install
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Kill running instance before uninstall
  nsExec::ExecToLog 'taskkill /F /IM "NetworkTool.exe"'
  Sleep 500
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Clean up application data directory
  RMDir /r "$APPDATA\com.networktool.app"
  RMDir /r "$LOCALAPPDATA\com.networktool.app"

  ; Clean up any leftover log files
  RMDir /r "$APPDATA\NetworkTool"
  RMDir /r "$LOCALAPPDATA\NetworkTool"
!macroend
