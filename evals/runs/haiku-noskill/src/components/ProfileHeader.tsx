import { fake } from "autoskeleton";
import type { Profile } from "../api";

// Stand-in data used to lay out the skeleton while the profile loads.
export const profilePlaceholder: Profile = {
  id: "placeholder",
  name: fake.name(1),
  username: fake.text(8, 2),
  avatarUrl: fake.image(80, 80),
  bio: fake.sentence(12, 3),
  location: fake.text(12, 4),
  stats: { orders: fake.number(2), reviews: fake.number(2), points: fake.number(4) },
  tier: "gold",
};

export function ProfileHeader({ profile }: { profile: Profile }) {
  return (
    <div className="panel profile">
      <img className="profile-avatar" src={profile.avatarUrl} alt={profile.name} width={80} height={80} />
      <div className="profile-main">
        <div className="profile-name-row">
          <h1>{profile.name}</h1>
          <span className={`tier tier-${profile.tier}`}>{profile.tier} member</span>
        </div>
        <div className="muted">
          @{profile.username} · {profile.location}
        </div>
        <p className="profile-bio">{profile.bio}</p>
      </div>
      <dl className="profile-stats">
        <div>
          <dt>Orders</dt>
          <dd>{profile.stats.orders}</dd>
        </div>
        <div>
          <dt>Reviews</dt>
          <dd>{profile.stats.reviews}</dd>
        </div>
        <div>
          <dt>Points</dt>
          <dd>{profile.stats.points.toLocaleString()}</dd>
        </div>
      </dl>
    </div>
  );
}
