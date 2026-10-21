//! `alert`, `confirm` and `prompt` in the window. WKWebView shows them only when its UI delegate
//! answers them, and wry's doesn't: `confirm` would always be false and `prompt` always null, so
//! deleting, merging, renaming and committing in the Studio would quietly do nothing. The three
//! answers are added to wry's delegate class here and shown as sheets on the window. A message's
//! first line is the sheet's title, the rest goes under it.

use std::ffi::{c_void, CStr};

use block2::{Block, RcBlock};
use objc2::{
    ffi, msg_send,
    rc::Retained,
    runtime::{AnyClass, AnyObject, Bool, Imp, Sel},
    sel, MainThreadMarker,
};
use objc2_app_kit::{NSAlert, NSAlertFirstButtonReturn, NSModalResponse, NSTextField, NSWindow};
use objc2_foundation::{NSPoint, NSRect, NSSize, NSString};

/// Teaches the delegate of `webview` (a WKWebView) to answer the three. Call it on the main thread.
pub unsafe fn install(webview: *mut c_void) {
    let webview = webview.cast::<AnyObject>();
    let delegate: *mut AnyObject = msg_send![webview, UIDelegate];
    if delegate.is_null() {
        return;
    }
    let class = ffi::object_getClass(delegate).cast_mut();
    add(
        class,
        sel!(webView:runJavaScriptAlertPanelWithMessage:initiatedByFrame:completionHandler:),
        alert as *const (),
        c"v@:@@@@?",
    );
    add(
        class,
        sel!(webView:runJavaScriptConfirmPanelWithMessage:initiatedByFrame:completionHandler:),
        confirm as *const (),
        c"v@:@@@@?",
    );
    add(
        class,
        sel!(webView:runJavaScriptTextInputPanelWithPrompt:defaultText:initiatedByFrame:completionHandler:),
        prompt as *const (),
        c"v@:@@@@@?",
    );
    // WebKit looks at what the delegate answers when it is set, so set it again.
    let _: () = msg_send![webview, setUIDelegate: delegate];
}

unsafe fn add(class: *mut AnyClass, name: Sel, imp: *const (), types: &CStr) {
    ffi::class_addMethod(
        class,
        name,
        std::mem::transmute::<*const (), Imp>(imp),
        types.as_ptr(),
    );
}

unsafe extern "C-unwind" fn alert(
    _: *mut AnyObject,
    _: Sel,
    webview: *mut AnyObject,
    message: *mut NSString,
    _: *mut AnyObject,
    handler: *mut Block<dyn Fn()>,
) {
    let handler = RcBlock::copy(handler).expect("the alert's completion handler");
    ask(webview, &*message, &["好"], None, move |_, _| {
        handler.call(())
    });
}

unsafe extern "C-unwind" fn confirm(
    _: *mut AnyObject,
    _: Sel,
    webview: *mut AnyObject,
    message: *mut NSString,
    _: *mut AnyObject,
    handler: *mut Block<dyn Fn(Bool)>,
) {
    let handler = RcBlock::copy(handler).expect("the confirm's completion handler");
    ask(
        webview,
        &*message,
        &["确定", "取消"],
        None,
        move |ok, _| handler.call((Bool::new(ok),)),
    );
}

unsafe extern "C-unwind" fn prompt(
    _: *mut AnyObject,
    _: Sel,
    webview: *mut AnyObject,
    message: *mut NSString,
    typed: *mut NSString,
    _: *mut AnyObject,
    handler: *mut Block<dyn Fn(*mut NSString)>,
) {
    let handler = RcBlock::copy(handler).expect("the prompt's completion handler");
    let typed = Retained::retain(typed).unwrap_or_else(NSString::new);
    ask(
        webview,
        &*message,
        &["确定", "取消"],
        Some(&typed),
        move |ok, text| {
            let answer = text.filter(|_| ok);
            handler.call((answer.map_or(std::ptr::null_mut(), |text| {
                Retained::as_ptr(&text).cast_mut()
            }),));
        },
    );
}

/// Shows `message` with `buttons` (the first is the answer, Return; the second is Esc) and, given
/// `field`, a text field filled with it. `done` gets whether the first button was chosen and the field's text.
unsafe fn ask(
    webview: *mut AnyObject,
    message: &NSString,
    buttons: &[&str],
    field: Option<&NSString>,
    done: impl Fn(bool, Option<Retained<NSString>>) + 'static,
) {
    let mtm = MainThreadMarker::new_unchecked();
    let alert = NSAlert::new(mtm);
    let text = message.to_string();
    let (title, rest) = text.split_once('\n').unwrap_or((&text, ""));
    alert.setMessageText(&NSString::from_str(title));
    alert.setInformativeText(&NSString::from_str(rest.trim()));
    for (i, label) in buttons.iter().enumerate() {
        let button = alert.addButtonWithTitle(&NSString::from_str(label));
        if i == 1 {
            button.setKeyEquivalent(&NSString::from_str("\u{1b}"));
        }
    }
    let field = field.map(|value| {
        let field = NSTextField::initWithFrame(
            mtm.alloc(),
            NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(300.0, 24.0)),
        );
        field.setStringValue(value);
        alert.setAccessoryView(Some(&field));
        field
    });
    let window: Option<Retained<NSWindow>> = msg_send![webview, window];
    let keep = alert.clone();
    let answered = RcBlock::new(move |response: NSModalResponse| {
        let _ = &keep;
        done(
            response == NSAlertFirstButtonReturn,
            field.as_ref().map(|field| field.stringValue()),
        );
    });
    match window {
        Some(window) => {
            alert.beginSheetModalForWindow_completionHandler(&window, Some(&answered));
            if let Some(field) = alert.accessoryView() {
                alert.window().makeFirstResponder(Some(&field));
            }
        }
        None => answered.call((alert.runModal(),)),
    }
}
