export const FIGURES = [
  { id:"baldwin", name:"James Baldwin", icon:"\u270D\uFE0F", color:"#8B6E52", sig:"The fire this time", cat:"Literature" },
  { id:"morrison", name:"Toni Morrison", icon:"\uD83D\uDCD6", color:"#5E7A62", sig:"Song of self", cat:"Literature" },
  { id:"basquiat", name:"Jean-Michel Basquiat", icon:"\uD83D\uDC51", color:"#C27A5A", sig:"The crown", cat:"Art" },
  { id:"hurston", name:"Zora Neale Hurston", icon:"\uD83C\uDF3F", color:"#7A9A7E", sig:"Their eyes", cat:"Literature" },
  { id:"angelou", name:"Maya Angelou", icon:"\uD83D\uDD4A\uFE0F", color:"#6B6590", sig:"Still I rise", cat:"Literature" },
  { id:"parks", name:"Gordon Parks", icon:"\uD83D\uDCF7", color:"#52708B", sig:"The lens", cat:"Art" },
  { id:"simone", name:"Nina Simone", icon:"\uD83C\uDFB9", color:"#7A5278", sig:"Feeling good", cat:"Culture" },
  { id:"hooks", name:"bell hooks", icon:"\uD83D\uDCA1", color:"#8B7E52", sig:"All about love", cat:"Literature" },
  { id:"butler", name:"Octavia Butler", icon:"\uD83C\uDF0C", color:"#5E6B8B", sig:"The sower", cat:"Literature" },
  { id:"davis", name:"Angela Davis", icon:"\u270A", color:"#8B5E5E", sig:"Freedom", cat:"Culture" },
  { id:"hughes", name:"Langston Hughes", icon:"\uD83C\uDF0A", color:"#52788B", sig:"Dream deferred", cat:"Literature" },
  { id:"kahlo", name:"Frida Kahlo", icon:"\uD83C\uDF3A", color:"#8B6E6E", sig:"The wound", cat:"Art" },
]

export function getFigure(id) {
  return FIGURES.find(f => f.id === id) || FIGURES[0]
}
