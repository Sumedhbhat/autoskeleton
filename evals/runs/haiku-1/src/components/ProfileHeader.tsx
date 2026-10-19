import { fake } from "autoskeleton";
import type { Profile } from "../api";

export const PROFILE_PLACEHOLDER: Profile = {
  id: "placeholder",
  name: fake.name(),
  username: fake.text(8),
  avatarUrl: fake.image(80, 80),
  bio: fake.sentence(14),
  location: fake.text(12),
  stats: { orders: 8888, reviews: 888, points: 88888 },
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
