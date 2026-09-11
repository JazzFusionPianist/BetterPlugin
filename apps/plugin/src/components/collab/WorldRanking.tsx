import { useT } from '../../i18n/LanguageContext'
import type { WorldStanding } from '../../hooks/useWorldScores'

/** The pinball start-card ranking block, shared by the solo games. */
export default function WorldRanking({ standing, loading, currentUserId }: {
  standing: WorldStanding | null
  loading: boolean
  currentUserId: string
}) {
  const { t } = useT()
  return (
    <div className="pb-lb">
      <div className="pb-lb-title">{t('pb.leaderboard')}</div>
      {loading && <div className="pb-lb-loading">…</div>}
      {!loading && standing && standing.top.length > 0 && (
        <div className="pb-lb-rows">
          {standing.top.map((row, i) => (
            <div key={row.user_id} className={`pb-lb-row${row.user_id === currentUserId ? ' me' : ''}`}>
              <span className="pb-lb-rank">{i + 1}</span>
              <span className="pb-lb-name">{row.display_name}</span>
              <span className="pb-lb-score">{row.best_score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      {!loading && standing && (
        <div className="pb-lb-mine">
          {t('pb.yourBest')} {standing.myBest.toLocaleString()}
          {standing.myRank != null && standing.totalPlayers > 0 && (
            <> · {t('pb.rank')} {standing.myRank}/{standing.totalPlayers}</>
          )}
        </div>
      )}
    </div>
  )
}
