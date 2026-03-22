// frontend/src/pages/admin/CollectionManager.jsx
import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const CollectionManager = () => {
  const [collections, setCollections] = useState([]);
  const [formData, setFormData] = useState({ name: '', creator_address: '', hashlist: '' });
  const [editMode, setEditMode] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);

  const fetchCollections = async () => {
    try {
      const response = await api.admin.getCollections();
      if (response.data.success) {
        setCollections(response.data.data);
      } else {
        console.error('Collection fetch failed:', response.data.message);
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({ ...prev, hashlist: file }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('creator_address', formData.creator_address);
      if (formData.hashlist instanceof File) {
        data.append('hashlist', formData.hashlist);
      }

      if (editMode && selectedCollectionId) {
        await api.admin.updateCollection(selectedCollectionId, data);
      } else {
        await api.admin.addCollection(data);
      }

      setFormData({ name: '', creator_address: '', hashlist: '' });
      setEditMode(false);
      setSelectedCollectionId(null);
      fetchCollections();
    } catch (error) {
      console.error('Error saving collection:', error);
    }
  };

  const handleEdit = (collection) => {
    setEditMode(true);
    setSelectedCollectionId(collection.id);
    setFormData({
      name: collection.name,
      creator_address: collection.creator_address,
      hashlist: '' // do not preload the file
    });
  };

  const handleCancel = () => {
    setEditMode(false);
    setSelectedCollectionId(null);
    setFormData({ name: '', creator_address: '', hashlist: '' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this collection?')) return;
    try {
      await api.admin.deleteCollection(id);
      fetchCollections();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  return (
    <div className="space-y-8 p-6">
      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow-md space-y-4">
        <h2 className="text-xl font-bold">{editMode ? 'Update Collection' : 'Add Collection'}</h2>

        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Collection Name"
          className="w-full border p-2"
          required
        />
        <input
          type="text"
          name="creator_address"
          value={formData.creator_address}
          onChange={handleChange}
          placeholder="Creator Address"
          className="w-full border p-2"
          required
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hashlist (TXT or JSON file with one NFT address per line)
          </label>
          <input
            type="file"
            accept=".txt, .json"
            onChange={handleFileChange}
            className="w-full"
          />
          <p className="mt-1 text-xs text-gray-500">
            File should contain one NFT mint address per line or be a JSON array of addresses
          </p>
        </div>

        <div className="flex gap-2">
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
            {editMode ? 'Update' : 'Add'}
          </button>
          {editMode && (
            <button
              type="button"
              onClick={handleCancel}
              className="bg-gray-400 text-white px-4 py-2 rounded"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Existing Collections */}
      {collections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {collections.map((col) => (
            <div key={col.id} className="border p-4 rounded shadow">
              <h3 className="text-lg font-semibold">{col.name}</h3>
              <p>Creator: {col.creator_address}</p>
              <p>Items in Hashlist: {col.hashlist_count || 0}</p>
              <p>Staked NFTs: {col.staked_count || 0}</p>
              <p>Stake Fee: {col.stake_fee} SOL</p>
              <p>Unstake Fee: {col.unstake_fee} SOL</p>
              <p>Claim Fee: {col.claim_fee} SOL</p>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleEdit(col)}
                  className="bg-yellow-500 text-white px-3 py-1 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(col.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CollectionManager;