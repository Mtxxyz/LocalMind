use std::{ffi::c_void, ptr, sync::OnceLock};

#[allow(dead_code)]
#[derive(Clone, Copy)]
#[repr(C)]
struct LogFontW {
    lf_height: i32,
    lf_width: i32,
    lf_escapement: i32,
    lf_orientation: i32,
    lf_weight: i32,
    lf_italic: u8,
    lf_underline: u8,
    lf_strike_out: u8,
    lf_char_set: u8,
    lf_out_precision: u8,
    lf_clip_precision: u8,
    lf_quality: u8,
    lf_pitch_and_family: u8,
    lf_face_name: [u16; 32],
}

type FontEnumProcW = unsafe extern "system" fn(
    *const LogFontW,
    *const c_void,
    u32,
    isize,
) -> i32;

#[cfg(windows)]
#[link(name = "user32")]
extern "system" {
    fn GetDC(hwnd: *mut c_void) -> *mut c_void;
    fn ReleaseDC(hwnd: *mut c_void, hdc: *mut c_void) -> i32;
}

#[cfg(windows)]
#[link(name = "gdi32")]
extern "system" {
    fn EnumFontFamiliesExW(
        hdc: *mut c_void,
        logfont: *const LogFontW,
        callback: Option<FontEnumProcW>,
        lparam: isize,
        flags: u32,
    ) -> i32;
}

#[cfg(windows)]
unsafe extern "system" fn collect_font_family(
    logfont: *const LogFontW,
    _metrics: *const c_void,
    _font_type: u32,
    lparam: isize,
) -> i32 {
    if logfont.is_null() || lparam == 0 {
        return 1;
    }
    let fonts = &mut *(lparam as *mut Vec<String>);
    let face = (*logfont).lf_face_name;
    let len = face.iter().position(|unit| *unit == 0).unwrap_or(face.len());
    if len > 0 {
        let name = String::from_utf16_lossy(&face[..len]);
        if !name.is_empty()
            && !name.starts_with('@')
            && !fonts.iter().any(|existing| existing.eq_ignore_ascii_case(&name))
        {
            fonts.push(name);
        }
    }
    1
}

#[cfg(windows)]
fn collect_fonts() -> Vec<String> {
    // A null HWND gives a screen device context, which exposes installed fonts.
    let hdc = unsafe { GetDC(ptr::null_mut()) };
    if hdc.is_null() {
        return Vec::new();
    }

    let mut logfont: LogFontW = unsafe { std::mem::zeroed() };
    // DEFAULT_CHARSET enumerates every installed typeface and character set.
    logfont.lf_char_set = 1;
    let mut fonts: Vec<String> = Vec::new();
    unsafe {
        EnumFontFamiliesExW(
            hdc,
            &logfont,
            Some(collect_font_family),
            &mut fonts as *mut Vec<String> as isize,
            0,
        );
        ReleaseDC(ptr::null_mut(), hdc);
    }

    fonts.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    fonts
}

#[cfg(not(windows))]
fn collect_fonts() -> Vec<String> {
    Vec::new()
}

/// Returns installed font family names for the editor/preview font pickers.
#[tauri::command(rename_all = "snake_case")]
pub fn list_fonts() -> Result<Vec<String>, String> {
    static CACHE: OnceLock<Vec<String>> = OnceLock::new();
    Ok(CACHE.get_or_init(collect_fonts).clone())
}
