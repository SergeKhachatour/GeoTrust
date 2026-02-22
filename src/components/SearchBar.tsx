import React, { useState } from 'react';
import './SearchBar.css';

interface SearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = 'Search contracts, addresses...',
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (onSearch) {
      onSearch(e.target.value.trim());
    }
  };

  return (
    <div className="search-bar-container">
      <form onSubmit={handleSubmit} className="search-bar-form">
        <input
          type="text"
          className="search-bar-input"
          placeholder={placeholder}
          value={searchQuery}
          onChange={handleChange}
        />
        <button type="submit" className="search-bar-button" aria-label="Search">
          🔍
        </button>
      </form>
    </div>
  );
};
