import React from 'react'
import './Reactions.css'

type MessageInfoModalProps = {
  open: boolean
  data?: any
  loading?: boolean
  onClose: () => void
}

export default function MessageInfoModal({ open, data, loading, onClose }: MessageInfoModalProps) {
  if (!open) return null

  return (
    <div className="ctx-wrap" onClick={onClose}>
      <div className="menu ctx message-info" onClick={(e) => e.stopPropagation()}>
        {loading && <p>Loading…</p>}
        {!loading && data && (
          <div className="info-body">
            <h4>Message details</h4>
            <dl>
              <dt>Sent by</dt>
              <dd>{data.sender?.name || 'Unknown'}</dd>
              <dt>Sent at</dt>
              <dd>{data.created_at ? new Date(data.created_at).toLocaleString() : '—'}</dd>
              {data.content && (
                <>
                  <dt>Content</dt>
                  <dd>{data.content}</dd>
                </>
              )}
              {data.attachment && (
                <>
                  <dt>Attachment</dt>
                  <dd><a href={data.attachment} target="_blank" rel="noreferrer">Open</a></dd>
                </>
              )}
              {data.audio && (
                <>
                  <dt>Audio</dt>
                  <dd><a href={data.audio} target="_blank" rel="noreferrer">Listen</a></dd>
                </>
              )}
              {Array.isArray(data.delivered_to) && data.delivered_to.length > 0 && (
                <>
                  <dt>Delivered to</dt>
                  <dd>{data.delivered_to.map((u: any) => u.name || u.username || u.id).join(', ')}</dd>
                </>
              )}
              {Array.isArray(data.read_by) && data.read_by.length > 0 && (
                <>
                  <dt>Read by</dt>
                  <dd>{data.read_by.map((u: any) => u.name || u.username || u.id).join(', ')}</dd>
                </>
              )}
              {data.note && (
                <>
                  <dt>Your note</dt>
                  <dd>{data.note}</dd>
                </>
              )}
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}
