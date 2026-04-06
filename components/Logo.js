export default function Logo({ size = 'full' }) {
  if (size === 'icon') return (
    <div style={{position:'relative',width:42,height:42,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      <div style={{position:'absolute',top:0,left:0,width:10,height:10,borderTop:'1px solid rgba(194,122,90,0.5)',borderLeft:'1px solid rgba(194,122,90,0.5)'}}/>
      <div style={{position:'absolute',top:0,right:0,width:10,height:10,borderTop:'1px solid rgba(194,122,90,0.5)',borderRight:'1px solid rgba(194,122,90,0.5)'}}/>
      <div style={{position:'absolute',bottom:0,left:0,width:10,height:10,borderBottom:'1px solid rgba(194,122,90,0.5)',borderLeft:'1px solid rgba(194,122,90,0.5)'}}/>
      <div style={{position:'absolute',bottom:0,right:0,width:10,height:10,borderBottom:'1px solid rgba(194,122,90,0.5)',borderRight:'1px solid rgba(194,122,90,0.5)'}}/>
      <div style={{position:'relative'}}><span style={{fontFamily:'var(--cs)',fontSize:22,fontWeight:500,color:'var(--ink)'}}>u</span><div style={{position:'absolute',top:'50%',left:-4,right:-4,height:1,background:'rgba(194,122,90,0.55)',transform:'translateY(-50%) rotate(-1.5deg)'}}/></div>
    </div>
  )
  return (
    <div style={{position:'relative',padding:'6px 16px',display:'inline-flex',flexDirection:'column',alignItems:'center'}}>
      <div style={{position:'absolute',top:0,left:0,width:12,height:12,borderTop:'1px solid rgba(194,122,90,0.45)',borderLeft:'1px solid rgba(194,122,90,0.45)'}}/>
      <div style={{position:'absolute',top:0,right:0,width:12,height:12,borderTop:'1px solid rgba(194,122,90,0.45)',borderRight:'1px solid rgba(194,122,90,0.45)'}}/>
      <div style={{position:'absolute',bottom:0,left:0,width:12,height:12,borderBottom:'1px solid rgba(194,122,90,0.45)',borderLeft:'1px solid rgba(194,122,90,0.45)'}}/>
      <div style={{position:'absolute',bottom:0,right:0,width:12,height:12,borderBottom:'1px solid rgba(194,122,90,0.45)',borderRight:'1px solid rgba(194,122,90,0.45)'}}/>
      <div style={{position:'relative',display:'inline-block'}}><span style={{fontFamily:'var(--cs)',fontSize:26,fontWeight:500,color:'var(--ink)',letterSpacing:1}}>unscripted</span><div style={{position:'absolute',top:'50%',left:-8,right:-8,height:'1.2px',background:'linear-gradient(90deg,transparent,rgba(194,122,90,0.55) 12%,rgba(194,122,90,0.55) 88%,transparent)',transform:'translateY(-50%) rotate(-1.2deg)'}}/></div>
    </div>
  )
}
