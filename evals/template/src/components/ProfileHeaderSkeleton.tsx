// Hand-maintained copy of ProfileHeader's layout. Must be kept in sync by hand.
export function ProfileHeaderSkeleton() {
  return (
    <div className="panel profile">
      <div className="sk sk-circle" style={{ width: 80, height: 80 }} />
      <div className="profile-main">
        <div className="sk sk-line" style={{ width: 220, height: 26 }} />
        <div className="sk sk-line" style={{ width: 160, marginTop: 8 }} />
        <div className="sk sk-line" style={{ width: "90%", marginTop: 12 }} />
        <div className="sk sk-line" style={{ width: "70%", marginTop: 6 }} />
      </div>
      <div className="profile-stats">
        <div className="sk sk-block" style={{ width: 60, height: 44 }} />
        <div className="sk sk-block" style={{ width: 60, height: 44 }} />
        <div className="sk sk-block" style={{ width: 60, height: 44 }} />
      </div>
    </div>
  );
}
