import { useState, useRef } from "react";

const Y = {
  50: "#FFFBEA", 100: "#FFF3C4", 200: "#FCE588",
  400: "#FACC15", 600: "#CA8A04", 700: "#A16207", 800: "#854D0E", 900: "#431407"
};

const initPlaces = ["Place 1", "Place 2", "Place 3"];
const initPhotos = [];

export default function App() {
  const [places, setPlaces] = useState(initPlaces);
  const [photos, setPhotos] = useState(initPhotos);
  const [activeTab, setActiveTab] = useState("All Memories");

  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ caption: "", place: "", url: "" });
  const [previewUrl, setPreviewUrl] = useState(null);

  const [showManage, setShowManage] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [editingPlace, setEditingPlace] = useState(null);
  const [editPlaceVal, setEditPlaceVal] = useState("");

  const [editPhotoId, setEditPhotoId] = useState(null);
  const [editCaption, setEditCaption] = useState("");
  const [deletePhotoId, setDeletePhotoId] = useState(null);

  const fileRef = useRef();
  const nextId = useRef(1);

  const allTabs = ["All Memories", ...places];
  const filtered = activeTab === "All Memories" ? photos : photos.filter(p => p.place === activeTab);

  function openUpload() {
    setUploadForm({ caption: "", place: places[0] || "", url: "" });
    setPreviewUrl(null);
    setShowUpload(true);
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setPreviewUrl(ev.target.result);
      setUploadForm(f => ({ ...f, url: ev.target.result }));
    };
    reader.readAsDataURL(file);
  }

  function handleAddPhoto() {
    if (!uploadForm.url || !uploadForm.place) return;
    setPhotos(p => [...p, { id: nextId.current++, ...uploadForm }]);
    setShowUpload(false);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function addPlace() {
    const t = newPlaceName.trim();
    if (!t || places.includes(t)) return;
    setPlaces(p => [...p, t]);
    setNewPlaceName("");
  }

  function startRename(place) {
    setEditingPlace(place);
    setEditPlaceVal(place);
  }

  function saveRename() {
    const t = editPlaceVal.trim();
    if (!t || (places.includes(t) && t !== editingPlace)) return;
    setPlaces(p => p.map(pl => pl === editingPlace ? t : pl));
    setPhotos(p => p.map(ph => ph.place === editingPlace ? { ...ph, place: t } : ph));
    if (activeTab === editingPlace) setActiveTab(t);
    if (uploadForm.place === editingPlace) setUploadForm(f => ({ ...f, place: t }));
    setEditingPlace(null);
  }

  function deletePlace(place) {
    setPlaces(p => p.filter(pl => pl !== place));
    setPhotos(p => p.filter(ph => ph.place !== place));
    if (activeTab === place) setActiveTab("All Memories");
    if (editingPlace === place) setEditingPlace(null);
  }

  function saveCaption(id) {
    setPhotos(p => p.map(ph => ph.id === id ? { ...ph, caption: editCaption } : ph));
    setEditPhotoId(null);
  }

  function confirmDeletePhoto() {
    setPhotos(p => p.filter(ph => ph.id !== deletePhotoId));
    setDeletePhotoId(null);
  }

  const btn = (label, onClick, style = {}) => (
    <button onClick={onClick} style={{ border: "none", borderRadius: 10, padding: "10px 0", fontSize: 14, cursor: "pointer", fontWeight: 500, ...style }}>{label}</button>
  );

  return (
    <div style={{ fontFamily: "var(--font-sans)", background: Y[50], minHeight: "100vh", paddingBottom: "3rem" }}>

      {/* Header */}
      <div style={{ background: Y[100], borderBottom: `2px solid ${Y[200]}`, padding: "1.25rem 1.5rem 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: Y[800] }}>🌼 Our Memories</h1>
            <p style={{ margin: 0, fontSize: 13, color: Y[600] }}>every moment we've shared, saved forever</p>
          </div>
          <button onClick={openUpload} style={{ background: Y[400], border: "none", borderRadius: 999, padding: "8px 18px", fontWeight: 500, fontSize: 14, color: Y[900], cursor: "pointer" }}>
            + Add memory
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 0 }}>
          {allTabs.map(pl => (
            <button key={pl} onClick={() => setActiveTab(pl)} style={{
              background: activeTab === pl ? Y[400] : "transparent", border: "none",
              borderRadius: "8px 8px 0 0", padding: "8px 16px", fontSize: 14,
              fontWeight: activeTab === pl ? 500 : 400,
              color: activeTab === pl ? Y[900] : Y[700],
              cursor: "pointer", whiteSpace: "nowrap",
              borderBottom: activeTab === pl ? `2px solid ${Y[400]}` : "2px solid transparent"
            }}>{pl}</button>
          ))}
          <button onClick={() => { setShowManage(true); setEditingPlace(null); setNewPlaceName(""); }}
            style={{ background: "transparent", border: "none", borderRadius: "8px 8px 0 0", padding: "8px 14px", fontSize: 14, color: Y[600], cursor: "pointer", whiteSpace: "nowrap" }}>
            ✏️ Places
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: "1.5rem", columns: "2 160px", gap: "1rem" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem", color: Y[600], fontSize: 15 }}>
            No memories here yet — add your first one! 🌼
          </div>
        )}
        {filtered.map(photo => (
          <div key={photo.id} style={{ breakInside: "avoid", marginBottom: "1rem", borderRadius: 16, overflow: "hidden", border: `1.5px solid ${Y[200]}`, background: "#fff" }}>
            <img src={photo.url} alt={photo.caption} style={{ width: "100%", display: "block", objectFit: "cover" }} />
            <div style={{ padding: "10px 12px 12px" }}>
              {editPhotoId === photo.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <input value={editCaption} onChange={e => setEditCaption(e.target.value)}
                    style={{ fontSize: 13, borderRadius: 8, border: `1px solid ${Y[200]}`, padding: "6px 8px", background: Y[50], color: Y[800] }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => saveCaption(photo.id)} style={{ flex: 1, background: Y[400], border: "none", borderRadius: 8, padding: "5px 0", fontSize: 12, fontWeight: 500, color: Y[900], cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditPhotoId(null)} style={{ flex: 1, background: Y[100], border: "none", borderRadius: 8, padding: "5px 0", fontSize: 12, color: Y[700], cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ margin: "0 0 8px", fontSize: 13, color: "#444", lineHeight: 1.5 }}>
                    {photo.caption || <span style={{ color: Y[400], fontStyle: "italic" }}>no caption</span>}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, background: Y[100], color: Y[700], borderRadius: 99, padding: "2px 10px" }}>{photo.place}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => { setEditPhotoId(photo.id); setEditCaption(photo.caption); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, padding: "2px 4px" }}>✏️</button>
                      <button onClick={() => setDeletePhotoId(photo.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, padding: "2px 4px" }}>🗑️</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "1.5rem", width: "100%", maxWidth: 380, border: `2px solid ${Y[200]}` }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: 18, fontWeight: 500, color: Y[800] }}>Add a memory 🌼</h2>
            {previewUrl && <img src={previewUrl} alt="preview" style={{ width: "100%", borderRadius: 12, marginBottom: "0.75rem", maxHeight: 200, objectFit: "cover" }} />}
            <input type="file" accept="image/*" ref={fileRef} onChange={handleFile} style={{ display: "none" }} />
            <button onClick={() => fileRef.current.click()}
              style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1.5px dashed ${Y[400]}`, background: Y[50], color: Y[700], cursor: "pointer", marginBottom: "0.75rem", fontSize: 14 }}>
              {previewUrl ? "Change photo" : "Upload a photo"}
            </button>
            <input placeholder="Add a caption..." value={uploadForm.caption} onChange={e => setUploadForm(f => ({ ...f, caption: e.target.value }))}
              style={{ width: "100%", borderRadius: 10, border: `1.5px solid ${Y[200]}`, padding: "10px 12px", fontSize: 14, marginBottom: "0.75rem", boxSizing: "border-box", background: Y[50], color: Y[800] }} />
            {places.length > 0 ? (
              <select value={uploadForm.place} onChange={e => setUploadForm(f => ({ ...f, place: e.target.value }))}
                style={{ width: "100%", borderRadius: 10, border: `1.5px solid ${Y[200]}`, padding: "10px 12px", fontSize: 14, marginBottom: "1rem", background: Y[50], color: Y[800] }}>
                {places.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <p style={{ fontSize: 13, color: Y[600], marginBottom: "1rem" }}>No places yet — add some in ✏️ Places first.</p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              {btn("Save memory", handleAddPhoto, { flex: 1, background: uploadForm.url && places.length ? Y[400] : Y[200], color: Y[900], opacity: uploadForm.url && places.length ? 1 : 0.6 })}
              {btn("Cancel", () => setShowUpload(false), { flex: 1, background: Y[100], color: Y[700] })}
            </div>
          </div>
        </div>
      )}

      {/* Manage Places Modal */}
      {showManage && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "1.5rem", width: "100%", maxWidth: 360, border: `2px solid ${Y[200]}`, maxHeight: "80vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: 18, fontWeight: 500, color: Y[800] }}>Manage places 📍</h2>

            {places.length === 0 && (
              <p style={{ fontSize: 14, color: Y[600], marginBottom: "1rem" }}>No places yet. Add one below!</p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "1.25rem" }}>
              {places.map(place => (
                <div key={place} style={{ background: Y[50], borderRadius: 12, padding: "10px 12px", border: `1.5px solid ${Y[200]}` }}>
                  {editingPlace === place ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input value={editPlaceVal} onChange={e => setEditPlaceVal(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && saveRename()}
                        autoFocus
                        style={{ width: "100%", borderRadius: 8, border: `1.5px solid ${Y[400]}`, padding: "8px 10px", fontSize: 14, background: "#fff", color: Y[800], boxSizing: "border-box" }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={saveRename} style={{ flex: 1, background: Y[400], border: "none", borderRadius: 8, padding: "7px 0", fontSize: 13, fontWeight: 500, color: Y[900], cursor: "pointer" }}>Save name</button>
                        <button onClick={() => setEditingPlace(null)} style={{ flex: 1, background: Y[100], border: "none", borderRadius: 8, padding: "7px 0", fontSize: 13, color: Y[700], cursor: "pointer" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 14, color: Y[800], fontWeight: 500 }}>{place}</span>
                      <button onClick={() => startRename(place)}
                        style={{ background: Y[100], border: `1px solid ${Y[200]}`, borderRadius: 8, padding: "6px 14px", fontSize: 13, color: Y[700], cursor: "pointer" }}>
                        Rename
                      </button>
                      <button onClick={() => deletePlace(place)}
                        style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 14px", fontSize: 13, color: "#b91c1c", cursor: "pointer" }}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ borderTop: `1.5px solid ${Y[100]}`, paddingTop: "1rem", marginBottom: "1rem" }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: Y[600] }}>Add a new place</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input placeholder="e.g. Palawan, Siargao..." value={newPlaceName}
                  onChange={e => setNewPlaceName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addPlace()}
                  style={{ flex: 1, borderRadius: 10, border: `1.5px solid ${Y[200]}`, padding: "9px 12px", fontSize: 14, background: Y[50], color: Y[800] }} />
                <button onClick={addPlace} style={{ background: Y[400], border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 500, fontSize: 14, color: Y[900], cursor: "pointer" }}>Add</button>
              </div>
            </div>

            <button onClick={() => { setShowManage(false); setEditingPlace(null); setNewPlaceName(""); }}
              style={{ width: "100%", background: Y[100], border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, color: Y[700], cursor: "pointer", fontWeight: 500 }}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Delete Photo Confirm */}
      {deletePhotoId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "1.5rem", width: "100%", maxWidth: 300, textAlign: "center", border: `2px solid ${Y[200]}` }}>
            <p style={{ fontSize: 15, color: "#444", margin: "0 0 1.25rem" }}>Remove this memory?</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmDeletePhoto} style={{ flex: 1, background: "#fee2e2", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, color: "#b91c1c", cursor: "pointer", fontWeight: 500 }}>Remove</button>
              <button onClick={() => setDeletePhotoId(null)} style={{ flex: 1, background: Y[100], border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, color: Y[700], cursor: "pointer" }}>Keep it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}