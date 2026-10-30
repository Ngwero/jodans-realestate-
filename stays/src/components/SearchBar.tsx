import { useState, type FormEvent } from 'react'

type Props = {
  onSearch: (query: { where: string; checkIn: string; checkOut: string }) => void
}

export function SearchBar({ onSearch }: Props) {
  const [where, setWhere] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSearch({ where, checkIn, checkOut })
    document.getElementById('stays')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <form className="search-panel" onSubmit={submit} role="search">
      <div className="search-field">
        <label htmlFor="where">Where</label>
        <input
          id="where"
          placeholder="Kampala, Jinja, Bunyonyi…"
          value={where}
          onChange={(e) => setWhere(e.target.value)}
        />
      </div>
      <div className="search-field">
        <label htmlFor="checkin">Check in</label>
        <input
          id="checkin"
          type="date"
          value={checkIn}
          onChange={(e) => setCheckIn(e.target.value)}
        />
      </div>
      <div className="search-field">
        <label htmlFor="checkout">Check out</label>
        <input
          id="checkout"
          type="date"
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
        />
      </div>
      <button type="submit" className="btn btn-gold search-submit">
        Search
      </button>
    </form>
  )
}
