//go:build linux && cgo && !gtk4

package media

/*
#cgo pkg-config: gtk+-3.0 webkit2gtk-4.1
#include <gtk/gtk.h>
#include <webkit2/webkit2.h>

static gboolean postly_on_permission_request(WebKitWebView *view, WebKitPermissionRequest *request, gpointer data) {
	if (WEBKIT_IS_USER_MEDIA_PERMISSION_REQUEST(request) || WEBKIT_IS_DEVICE_INFO_PERMISSION_REQUEST(request)) {
		webkit_permission_request_allow(request);
		return TRUE;
	}
	return FALSE;
}

static WebKitWebView *postly_find_web_view(GtkWidget *widget) {
	if (WEBKIT_IS_WEB_VIEW(widget)) {
		return WEBKIT_WEB_VIEW(widget);
	}
	if (!GTK_IS_CONTAINER(widget)) {
		return NULL;
	}
	GList *children = gtk_container_get_children(GTK_CONTAINER(widget));
	WebKitWebView *found = NULL;
	for (GList *l = children; l != NULL && found == NULL; l = l->next) {
		found = postly_find_web_view(GTK_WIDGET(l->data));
	}
	g_list_free(children);
	return found;
}

static int postly_enable_media(void *window) {
	if (window == NULL) {
		return -1;
	}
	WebKitWebView *view = postly_find_web_view(GTK_WIDGET(window));
	if (view == NULL) {
		return -2;
	}
	if (g_object_get_data(G_OBJECT(view), "postly-media") != NULL) {
		return 1;
	}
	WebKitSettings *settings = webkit_web_view_get_settings(view);
	webkit_settings_set_enable_media_stream(settings, TRUE);
	webkit_settings_set_enable_mediasource(settings, TRUE);
#if WEBKIT_CHECK_VERSION(2, 38, 0)
	webkit_settings_set_enable_webrtc(settings, TRUE);
#endif
	g_signal_connect(view, "permission-request", G_CALLBACK(postly_on_permission_request), NULL);
	g_object_set_data(G_OBJECT(view), "postly-media", GINT_TO_POINTER(1));
	return 1;
}
*/
import "C"

import (
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func EnableWebviewMedia(win *application.WebviewWindow) {
	application.InvokeAsync(func() {
		switch C.postly_enable_media(win.NativeWindow()) {
		case 1:
			log.Println("media: microphone enabled in WebKitGTK")
		case -1:
			log.Println("media: native window is not ready")
		default:
			log.Println("media: WebKitWebView not found")
		}
	})
}
