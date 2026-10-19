import { useId } from 'react'

/** Original book-and-arch illustration; not a university building or official emblem. */
export function CampusArtwork() {
  const id = useId()
  const paint = (name: string) => `url(#${id}-${name})`
  return <svg className="campus-artwork" viewBox="0 0 460 330" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-paper`} x1="120" y1="170" x2="255" y2="277" gradientUnits="userSpaceOnUse"><stop stopColor="#fff" /><stop offset="1" stopColor="#bfd8f0" /></linearGradient>
      <linearGradient id={`${id}-page`} x1="320" y1="174" x2="229" y2="258" gradientUnits="userSpaceOnUse"><stop stopColor="#edf7ff" /><stop offset="1" stopColor="#86aed5" /></linearGradient>
      <linearGradient id={`${id}-arch`} x1="180" y1="88" x2="288" y2="221" gradientUnits="userSpaceOnUse"><stop stopColor="#f0f8ff" /><stop offset=".48" stopColor="#abcce9" /><stop offset="1" stopColor="#6a9bc8" /></linearGradient>
      <linearGradient id={`${id}-glass`} x1="207" y1="121" x2="270" y2="221" gradientUnits="userSpaceOnUse"><stop stopColor="#8bb7df" stopOpacity=".22" /><stop offset="1" stopColor="#aacff0" stopOpacity=".04" /></linearGradient>
      <radialGradient id={`${id}-shadow`}><stop stopColor="#0a2345" stopOpacity=".35" /><stop offset="1" stopColor="#0a2345" stopOpacity="0" /></radialGradient>
    </defs>
    {/* Architectural drawing lines give the illustration room to breathe. */}
    <path d="M91 191V157a139 139 0 0 1 278 0v34" stroke="#a5c8e9" strokeOpacity=".2" strokeWidth=".8" />
    <path d="M111 183v-26a119 119 0 0 1 238 0v26" stroke="#a5c8e9" strokeOpacity=".1" strokeWidth=".8" />
    <path d="M54 241H406M230 31V55" stroke="#afcdec" strokeOpacity=".18" strokeWidth=".8" />
    <ellipse cx="232" cy="282" rx="163" ry="24" fill={paint('shadow')} />
    {/* The cover and staggered paper edges form a single open-book silhouette. */}
    <path d="M64 202C122 182 178 203 230 233C282 203 338 182 396 202V235C337 218 281 238 230 272C178 238 122 218 64 235Z" fill="#32638f" stroke="#92b8db" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M72 200C127 184 181 205 230 235C279 205 333 184 388 200V229C334 214 279 234 230 265C181 234 126 214 72 229Z" fill="#9cbede" />
    <path d="M72 219C130 206 180 226 230 256C280 226 330 206 388 219M72 224C130 211 180 231 230 261C280 231 330 211 388 224" stroke="#456f9b" strokeOpacity=".55" strokeWidth=".8" />
    <path d="M78 190C129 175 178 191 230 225V252C180 221 130 202 78 215Z" fill={paint('paper')} />
    <path d="M230 225C282 191 331 175 382 190V215C330 202 280 221 230 252Z" fill={paint('page')} />
    <path d="M78 190C129 175 178 191 230 225C282 191 331 175 382 190" stroke="#fff" strokeOpacity=".8" strokeWidth="1.2" />
    <path d="M230 225V252" stroke="#547fa9" strokeWidth="1" />
    {/* An abstract campus arch rises from the pages, with an inset glass opening. */}
    <path d="M181 207V130a51 51 0 0 1 102 0v77L271 215V132a39 39 0 0 0-78 0v83Z" fill="#517fa9" />
    <path d="M190 214V131a51 51 0 0 1 102 0v72L271 215V132a30 30 0 0 0-60 0v91Z" fill={paint('arch')} fillRule="evenodd" />
    <path d="M211 223V132a30 30 0 0 1 60 0v83L230 239Z" fill={paint('glass')} />
    <path d="M190 214V131a51 51 0 0 1 102 0v72M211 223V132a30 30 0 0 1 60 0v83" stroke="#f3f9ff" strokeOpacity=".75" strokeWidth="1" strokeLinecap="round" />
    <path d="M224 127V166M230 121V149" stroke="#bfdcf5" strokeOpacity=".25" strokeWidth=".8" />
    <path d="M215 220L241 206L267 212M224 230L250 216" stroke="#bdd7ed" strokeOpacity=".5" strokeWidth=".8" />
    {/* Fine page rules and one brass bookmark keep the palette restrained. */}
    <path d="M99 194C125 190 150 196 172 205M99 201C128 197 154 205 178 215M298 205C323 195 345 191 363 194M292 215C318 204 343 199 363 201" stroke="#507ba6" strokeOpacity=".32" strokeWidth="1" strokeLinecap="round" />
    <path d="M303 194L317 190V229L310 224L303 233Z" fill="#e8c58e" />
    <path d="M305 195L315 192" stroke="#fff3d8" strokeWidth=".8" />
    <circle cx="348" cy="108" r="4" fill="#e8c58e" />
    <path d="M323 108H338" stroke="#e8c58e" strokeOpacity=".6" strokeWidth=".8" />
  </svg>
}

export function FoodArtwork() {
  return <svg className="food-artwork" viewBox="0 0 250 180" fill="none" aria-hidden="true">
    <ellipse cx="127" cy="150" rx="91" ry="13" fill="#eadbc6" opacity=".5" />
    <path d="M52 94C55 142 85 156 127 156S199 142 202 94" fill="#ecf3fc" stroke="#3469a5" strokeWidth="3" />
    <ellipse cx="127" cy="94" rx="75" ry="30" fill="#fffaf0" stroke="#3469a5" strokeWidth="3" />
    <path d="M73 92C91 67 106 104 126 81S156 77 177 93M77 103C98 81 115 116 135 93S160 94 179 101" stroke="#e8ad55" strokeWidth="9" strokeLinecap="round" />
    <path d="M85 76C61 66 65 47 84 53C84 35 103 41 102 60C121 49 126 70 107 77" fill="#7caa68" />
    <ellipse cx="153" cy="76" rx="27" ry="21" transform="rotate(-18 153 76)" fill="#fff" stroke="#eddec3" strokeWidth="2" />
    <ellipse cx="153" cy="77" rx="12" ry="11" fill="#ffc651" />
    <path d="M92 96L107 101M117 87L128 91M158 105L171 101" stroke="#57915f" strokeWidth="4" strokeLinecap="round" />
    <circle cx="113" cy="130" r="3" fill="#3469a5" /><circle cx="141" cy="130" r="3" fill="#3469a5" /><path d="M121 135Q127 141 133 135" stroke="#3469a5" strokeWidth="2" strokeLinecap="round" />
    <path d="M180 80L222 26M188 86L235 35" stroke="#95683f" strokeWidth="5" strokeLinecap="round" />
    <path d="M115 48C103 34 126 33 115 17M140 45C131 34 151 29 143 18" stroke="#d9b890" strokeWidth="3" strokeLinecap="round" />
    <path d="M37 60V76M29 68H45M205 123V135M199 129H211" stroke="#dd9752" strokeWidth="2" strokeLinecap="round" />
  </svg>
}
