export default function Avatar({ member, size = 36 }) {
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        background: member.color || member.c || '#8B6E52',
        fontSize: size * 0.31,
      }}
    >
      {member.initials || member.i}
    </div>
  )
}
