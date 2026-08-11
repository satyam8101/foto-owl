import { useMediaActivity } from '@fotoowl/media-react';

export function ActivityFeed() {
  const { activity, clear } = useMediaActivity({ limit: 25 });

  return (
    <aside className="activity" aria-label="Media activity">
      <div className="activity-head">
        <strong>Activity</strong>
        <button type="button" className="btn-small" onClick={clear} disabled={activity.length === 0}>
          Clear
        </button>
      </div>
      {activity.length === 0 ? (
        <p className="activity-empty">
          SDK events will appear here. Open a photo, play a reel, or press “Track download”.
        </p>
      ) : (
        <ul className="activity-list">
          {activity.map((event, i) => (
            <li
              key={`${event.at}-${event.id}-${i}`}
              className={`activity-item activity-${event.type}`}
            >
              <span className="activity-type">{event.type}</span>
              <span className="activity-id">
                #{event.id} ({event.kind})
              </span>
              <span className="activity-source">{event.source}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
