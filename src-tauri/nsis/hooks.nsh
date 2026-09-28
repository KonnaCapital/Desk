; Desk owns exactly one autostart value, named after the product, so the
; Desk Dev test build never removes the real Desk's value. Remove only that
; value during a normal uninstall; the built-in Delete App Data choice remains
; separate.
!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode <> 1
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"
  ${EndIf}
!macroend
