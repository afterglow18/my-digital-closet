/**
 * Email verification landing page.
 *
 * Supabase redirects here after the user taps the confirmation link in their
 * email. Supabase processes the token before the redirect, so by the time the
 * user sees this page their account is already confirmed. We just need to tell
 * them to go back to the app.
 */

export default function AuthVerifiedPage() {
  const openApp = () => {
    // Deep-link into the native app. If not installed the browser will simply
    // ignore the scheme and stay on this page.
    window.location.href = "mydigitalcloset://";
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#FDECEF",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      {/* Logo mark */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: "#FFE047",
          border: "3px solid #000",
          boxShadow: "4px 4px 0px 0px #000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          marginBottom: "1.5rem",
        }}
      >
        ✓
      </div>

      <h1
        style={{
          fontSize: "1.75rem",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "-0.02em",
          margin: "0 0 0.75rem",
          lineHeight: 1.1,
        }}
      >
        Email Verified!
      </h1>

      <p
        style={{
          fontSize: "1rem",
          color: "rgba(0,0,0,0.55)",
          maxWidth: 300,
          lineHeight: 1.5,
          margin: "0 0 2rem",
        }}
      >
        You're all set. Open <strong>My Digital Closet</strong> on your phone
        and sign in to get started.
      </p>

      <button
        onClick={openApp}
        style={{
          padding: "0.9rem 2rem",
          background: "#FFE047",
          border: "2px solid #000",
          borderRadius: 14,
          fontWeight: 800,
          fontSize: "0.9rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          boxShadow: "3px 3px 0px 0px #000",
          cursor: "pointer",
          transition: "all 0.1s",
        }}
        onMouseDown={e =>
          ((e.currentTarget as HTMLButtonElement).style.boxShadow = "none")
        }
        onMouseUp={e =>
          ((e.currentTarget as HTMLButtonElement).style.boxShadow =
            "3px 3px 0px 0px #000")
        }
      >
        Open My Digital Closet →
      </button>

      <p
        style={{
          marginTop: "1.5rem",
          fontSize: "0.75rem",
          color: "rgba(0,0,0,0.3)",
        }}
      >
        You can close this tab if the app doesn't open automatically.
      </p>
    </div>
  );
}
