import React from 'react';
import { RoomLearningStatus as Status } from '../services/roomLearningStatusService';
import './RoomLearningStatus.css';

interface Props {
  status?: Status;
  error: boolean;
  dashboard?: boolean;
}

/** Only the room owner renders this summary; server rows determine its saved state. */
export default function RoomLearningStatus({ status, error, dashboard = false }: Props) {
  let content: React.ReactNode;
  if (error) content = <p role="status">Learner and target status unavailable.</p>;
  else if (!status) content = <p role="status">Loading learner status…</p>;
  else if (!status.learnerId) content = <p>No learner yet</p>;
  else content = <>
    <p>Learner: {status.learnerName || 'Name unavailable'}{!dashboard && status.joinedAt && <> · Joined {new Date(status.joinedAt).toLocaleString()}</>}</p>
    {status.targetsSaved ? <p className="room-learning-status-saved">Targets saved</p> : (!dashboard || status.hasMessages) && <p className="room-learning-status-warning" role="status">Targets not saved: learner progress is not being recorded</p>}
  </>;
  return <section className="room-learning-status" aria-label="Learner and saved targets">{content}</section>;
}
