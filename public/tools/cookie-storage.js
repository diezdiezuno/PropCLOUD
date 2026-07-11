/**
 * PropTools ↔ PropCLOUD — sesión compartida.
 * Adapter de storage para supabase-js que lee/escribe la MISMA cookie
 * que usa @supabase/ssr en el admin de PropCLOUD (prefijo "base64-",
 * chunking .0/.1/...). Así el login de PropCLOUD sirve para las
 * herramientas y viceversa: una sola sesión.
 */
(function () {
  var MAX_CHUNK = 3180;

  function readCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function writeCookie(name, value, maxAge) {
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/; Max-Age=' + maxAge + '; SameSite=Lax' + secure;
  }
  function b64uEncode(str) {
    var b = btoa(unescape(encodeURIComponent(str)));
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64uDecode(str) {
    var b = str.replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    return decodeURIComponent(escape(atob(b)));
  }

  var storage = {
    getItem: function (key) {
      // valor simple o chunked (key.0, key.1, ...)
      var raw = readCookie(key);
      if (raw === null) {
        var parts = [], i = 0, c;
        while ((c = readCookie(key + '.' + i)) !== null) { parts.push(c); i++; }
        if (parts.length === 0) return null;
        raw = parts.join('');
      }
      if (raw.indexOf('base64-') === 0) {
        try { return b64uDecode(raw.slice(7)); } catch (e) { return null; }
      }
      return raw;
    },
    setItem: function (key, value) {
      var encoded = 'base64-' + b64uEncode(value);
      this.removeItem(key);
      if (encoded.length <= MAX_CHUNK) {
        writeCookie(key, encoded, 31536000);
      } else {
        for (var i = 0; i * MAX_CHUNK < encoded.length; i++) {
          writeCookie(key + '.' + i, encoded.slice(i * MAX_CHUNK, (i + 1) * MAX_CHUNK), 31536000);
        }
      }
    },
    removeItem: function (key) {
      writeCookie(key, '', 0);
      var i = 0;
      while (readCookie(key + '.' + i) !== null) { writeCookie(key + '.' + i, '', 0); i++; }
    },
  };

  window.__ptAuthOpts = { auth: { storage: storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } };
})();
