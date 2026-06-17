import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons breaking under bundlers like Vite/CRA
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const supabase = createClient(
  "https://elazbfrcbqdbjugxwpho.supabase.co",
  "sb_publishable_KkMJwhiAZenfbdX-cWH5Sw_s90UiVrc"
);

const Y = {
  50: "#FFFBEA", 100: "#FFF3C4", 200: "#FCE588",
  400: "#FACC15", 600: "#CA8A04", 700: "#A16207", 800: "#854D0E", 900: "#431407"
};

const iconBtn = {
  background: Y[100], border: "none", borderRadius: 999, width: 36, height: 36,
  fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", flexShrink: 0
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [places, setPlaces] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [activeTab, setActiveTab] = useState("All Memories");
  const [loading, setLoading] = useState(true);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ caption: "", place_id: "", memory_date: todayISO() });
  const [uploadFiles, setUploadFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  const [showManage, setShowManage] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [editingPlace, setEditingPlace] = useState(null);
  const [editPlaceVal, setEditPlaceVal] = useState("");

  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [editPhotoCaption, setEditPhotoCaption] = useState("");
  const [editMemoryDate, setEditMemoryDate] = useState("");
  const [editingCaption, setEditingCaption] = useState(false);

  const [showMemoryLane, setShowMemoryLane] = useState(false);
  const [memoryLaneList, setMemoryLaneList] = useState([]);
  const [memoryLaneIndex, setMemoryLaneIndex] = useState(0);

  const [showMap, setShowMap] = useState(false);

  const fileRef = useRef();

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!showMemoryLane || memoryLaneList.length < 2) return;
    const id = setInterval(() => {
      setMemoryLaneIndex(i => (i + 1) % memoryLaneList.length);
    }, 4000);
    return () => clearInterval(id);
  }, [showMemoryLane, memoryLaneList.length]);

  async function loadAll() {
    setLoading(true);
    const [{ data: p }, { data: ph }] = await Promise.all([
      supabase.from("places").select("*").order("created_at"),
      supabase.from("photos").select("*, places(name)").order("created_at", { ascending: false })
    ]);
    setPlaces(p || []);
    setPhotos(ph || []);
    setLoading(false);
    backfillCoordinates(p || []);
  }

  async function loadComments(photoId) {
    const { data } = await supabase.from("comments").select("*").eq("photo_id", photoId).order("created_at");
    setComments(data || []);
  }

  // Geocoding (for map pins) — free OpenStreetMap lookup, no API key needed
  async function geocodePlace(name) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(name + ", Philippines")}`);
      const data = await res.json();
      if (data && data[0]) {
        return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
      }
    } catch (e) {
      console.error("Geocode failed", e);
    }
    return null;
  }

  async function backfillCoordinates(placesList) {
    for (const place of placesList) {
      if (place.latitude == null || place.longitude == null) {
        const coords = await geocodePlace(place.name);
        if (coords) {
          await supabase.from("places").update(coords).eq("id", place.id);
          setPlaces(prev => prev.map(pl => pl.id === place.id ? { ...pl, ...coords } : pl));
        }
        await new Promise(r => setTimeout(r, 1100)); // be gentle with the free geocoder
      }
    }
  }

  const filtered = activeTab === "All Memories"
    ? photos
    : activeTab === "❤️ Loved"
      ? [...photos].filter(p => (p.likes || 0) > 0).sort((a, b) => (b.likes || 0) - (a.likes || 0))
      : photos.filter(p => p.places?.name === activeTab);

  const today = new Date();
  const onThisDay = photos.filter(p => {
    if (!p.memory_date) return false;
    const d = new Date(p.memory_date);
    return d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() !== today.getFullYear();
  });

  const placesWithCoords = places.filter(p => p.latitude != null && p.longitude != null);
  const mapCenter = placesWithCoords.length
    ? [
        placesWithCoords.reduce((s, p) => s + p.latitude, 0) / placesWithCoords.length,
        placesWithCoords.reduce((s, p) => s + p.longitude, 0) / placesWithCoords.length
      ]
    : [12.8797, 121.7740];

  // Places
  async function addPlace() {
    const t = newPlaceName.trim();
    if (!t) return;
    const { data } = await supabase.from("places").insert({ name: t }).select().single();
    if (data) {
      setPlaces(p => [...p, data]);
      setNewPlaceName("");
      const coords = await geocodePlace(t);
      if (coords) {
        await supabase.from("places").update(coords).eq("id", data.id);
        setPlaces(p => p.map(pl => pl.id === data.id ? { ...pl, ...coords } : pl));
      }
    }
  }

  async function renamePlace() {
    const t = editPlaceVal.trim();
    if (!t) return;
    await supabase.from("places").update({ name: t }).eq("id", editingPlace.id);
    setPlaces(p => p.map(pl => pl.id === editingPlace.id ? { ...pl, name: t } : pl));
    setPhotos(p => p.map(ph => ph.place_id === editingPlace.id ? { ...ph, places: { name: t } } : ph));
    if (activeTab === editingPlace.name) setActiveTab(t);
    setEditingPlace(null);
  }

  async function deletePlace(place) {
    await supabase.from("places").delete().eq("id", place.id);
    setPlaces(p => p.filter(pl => pl.id !== place.id));
    setPhotos(p => p.filter(ph => ph.place_id !== place.id));
    if (activeTab === place.name) setActiveTab("All Memories");
  }

  // Photos
  function handleFiles(e) {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;
    setUploadFiles(fileList);
    setPreviewUrls(fileList.map(f => URL.createObjectURL(f)));
  }

  function removeSelectedFile(idx) {
    setUploadFiles(f => f.filter((_, i) => i !== idx));
    setPreviewUrls(u => u.filter((_, i) => i !== idx));
  }

  async function handleAddPhoto() {
    if (uploadFiles.length === 0 || !uploadForm.place_id) return;
    setUploading(true);
    const inserted = [];
    for (let i = 0; i < uploadFiles.length; i++) {
      const file = uploadFiles[i];
      setUploadProgress(`${i + 1}/${uploadFiles.length}`);
      const ext = file.name.split(".").pop();
      const filename = `${Date.now()}-${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from("our-memories").upload(filename, file);
      if (upErr) { alert("Upload failed: " + upErr.message); continue; }
      const { data: { publicUrl } } = supabase.storage.from("our-memories").getPublicUrl(filename);
      const { data } = await supabase.from("photos").insert({
        url: publicUrl,
        caption: uploadForm.caption,
        place_id: uploadForm.place_id,
        memory_date: uploadForm.memory_date
      }).select("*, places(name)").single();
      if (data) inserted.push(data);
    }
    if (inserted.length) setPhotos(p => [...inserted, ...p]);
    setShowUpload(false);
    setUploadFiles([]);
    setPreviewUrls([]);
    setUploadForm({ caption: "", place_id: "", memory_date: todayISO() });
    setUploading(false);
    setUploadProgress("");
  }

  async function deletePhoto(id) {
    await supabase.from("photos").delete().eq("id", id);
    setPhotos(p => p.filter(ph => ph.id !== id));
    setSelectedPhoto(null);
  }

  async function saveCaption() {
    await supabase.from("photos").update({ caption: editPhotoCaption, memory_date: editMemoryDate }).eq("id", selectedPhoto.id);
    setPhotos(p => p.map(ph => ph.id === selectedPhoto.id ? { ...ph, caption: editPhotoCaption, memory_date: editMemoryDate } : ph));
    setSelectedPhoto(s => ({ ...s, caption: editPhotoCaption, memory_date: editMemoryDate }));
    setEditingCaption(false);
  }

  async function toggleLike(photo, e) {
    e?.stopPropagation();
    const newLikes = (photo.likes || 0) + 1;
    await supabase.from("photos").update({ likes: newLikes }).eq("id", photo.id);
    setPhotos(p => p.map(ph => ph.id === photo.id ? { ...ph, likes: newLikes } : ph));
    if (selectedPhoto?.id === photo.id) setSelectedPhoto(s => ({ ...s, likes: newLikes }));
  }

  async function addComment() {
    const t = newComment.trim();
    if (!t) return;
    const { data } = await supabase.from("comments").insert({ photo_id: selectedPhoto.id, text: t }).select().single();
    if (data) setComments(c => [...c, data]);
    setNewComment("");
  }

  async function deleteComment(id) {
    await supabase.from("comments").delete().eq("id", id);
    setComments(c => c.filter(cm => cm.id !== id));
  }

  function openPhoto(photo) {
    setSelectedPhoto(photo);
    setEditPhotoCaption(photo.caption || "");
    setEditMemoryDate(photo.memory_date || todayISO());
    setEditingCaption(false);
    setNewComment("");
    loadComments(photo.id);
  }

  function openMemoryLane() {
    if (filtered.length === 0) return;
    setMemoryLaneList(filtered);
    setMemoryLaneIndex(0);
    setShowMemoryLane(true);
  }
  function closeMemoryLane() { setShowMemoryLane(false); }
  function nextSlide() { setMemoryLaneIndex(i => (i + 1) % memoryLaneList.length); }
  function prevSlide() { setMemoryLaneIndex(i => (i - 1 + memoryLaneList.length) % memoryLaneList.length); }

  function surpriseMe() {
    if (photos.length === 0) return;
    openPhoto(photos[Math.floor(Math.random() * photos.length)]);
  }

  if (loading) return (
    <div style={{ background: Y[50], minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 40 }}>🌼</div>
      <p style={{ color: Y[700], fontSize: 16 }}>Loading your memories...</p>
    </div>
  );

  return (
    <div style={{ fontFamily: "var(--font-sans)", background: Y[50], minHeight: "100vh", paddingBottom: "3rem" }}>

      {/* Header */}
      <div style={{ background: Y[100], borderBottom: `2px solid ${Y[200]}`, padding: "1.25rem 1.5rem 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: Y[800] }}>🌼 Our Memories</h1>
            <p style={{ margin: 0, fontSize: 13, color: Y[600] }}>every moment we've shared, saved forever</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button title="Surprise me" onClick={surpriseMe} style={iconBtn}>🎲</button>
            <button title="Memory Lane" onClick={openMemoryLane} style={iconBtn}>▶️</button>
            <button title="Map view" onClick={() => setShowMap(true)} style={iconBtn}>📍</button>
            <button onClick={() => { setShowUpload(true); setUploadForm({ caption: "", place_id: places[0]?.id || "", memory_date: todayISO() }); setPreviewUrls([]); setUploadFiles([]); }}
              style={{ background: Y[400], border: "none", borderRadius: 999, padding: "8px 18px", fontWeight: 500, fontSize: 14, color: Y[900], cursor: "pointer" }}>
              + Add memory
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
          {["All Memories", ...places.map(p => p.name), "❤️ Loved"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              background: activeTab === tab ? Y[400] : "transparent", border: "none",
              borderRadius: "8px 8px 0 0", padding: "8px 16px", fontSize: 14,
              fontWeight: activeTab === tab ? 500 : 400,
              color: activeTab === tab ? Y[900] : Y[700], cursor: "pointer", whiteSpace: "nowrap",
              borderBottom: activeTab === tab ? `2px solid ${Y[400]}` : "2px solid transparent"
            }}>{tab}</button>
          ))}
          <button onClick={() => { setShowManage(true); setEditingPlace(null); setNewPlaceName(""); }}
            style={{ background: "transparent", border: "none", borderRadius: "8px 8px 0 0", padding: "8px 14px", fontSize: 14, color: Y[600], cursor: "pointer", whiteSpace: "nowrap" }}>
            ✏️ Places
          </button>
        </div>
      </div>

      {/* On This Day */}
      {onThisDay.length > 0 && (
        <div style={{ padding: "1rem 1.5rem 0" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: 13, fontWeight: 500, color: Y[800] }}>✨ On this day</p>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
            {onThisDay.map(photo => (
              <div key={photo.id} onClick={() => openPhoto(photo)} style={{ flexShrink: 0, width: 110, cursor: "pointer" }}>
                <img src={photo.url} alt={photo.caption} style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 12, border: `1.5px solid ${Y[200]}` }} />
                <p style={{ margin: "4px 0 0", fontSize: 11, color: Y[600], textAlign: "center" }}>{new Date(photo.memory_date).getFullYear()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pinterest Grid */}
      <div style={{ padding: "1.5rem", columnWidth: "190px", columnGap: "0.75rem", maxWidth: 1400, margin: "0 auto" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem", color: Y[600], fontSize: 15 }}>
            No memories here yet — add your first one! 🌼
          </div>
        )}
        {filtered.map(photo => (
          <div key={photo.id} onClick={() => openPhoto(photo)}
            style={{ breakInside: "avoid", marginBottom: "0.75rem", borderRadius: 16, overflow: "hidden", border: `1.5px solid ${Y[200]}`, background: "#fff", cursor: "pointer", transition: "transform 0.15s", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
            <img src={photo.url} alt={photo.caption} style={{ width: "100%", display: "block", objectFit: "cover" }} />
            <div style={{ padding: "8px 10px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 6 }}>
              <div style={{ minWidth: 0 }}>
                {photo.caption && <p style={{ margin: "0 0 4px", fontSize: 12, color: "#444", lineHeight: 1.4 }}>{photo.caption}</p>}
                {photo.places?.name && <span style={{ fontSize: 10, background: Y[100], color: Y[700], borderRadius: 99, padding: "2px 8px" }}>{photo.places.name}</span>}
              </div>
              <button onClick={(e) => toggleLike(photo, e)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: Y[700], display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                ❤️ {photo.likes > 0 ? photo.likes : ""}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", border: `2px solid ${Y[200]}` }}>
            <img src={selectedPhoto.url} alt={selectedPhoto.caption} style={{ width: "100%", display: "block", borderRadius: "18px 18px 0 0", objectFit: "cover", maxHeight: 320 }} />
            <div style={{ padding: "1rem 1.25rem 1.25rem" }}>
              {/* Caption */}
              {editingCaption ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "1rem" }}>
                  <input value={editPhotoCaption} onChange={e => setEditPhotoCaption(e.target.value)}
                    style={{ borderRadius: 8, border: `1.5px solid ${Y[400]}`, padding: "8px 10px", fontSize: 14, color: Y[800], background: Y[50] }} />
                  <input type="date" value={editMemoryDate} onChange={e => setEditMemoryDate(e.target.value)}
                    style={{ borderRadius: 8, border: `1.5px solid ${Y[400]}`, padding: "8px 10px", fontSize: 14, color: Y[800], background: Y[50] }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={saveCaption} style={{ flex: 1, background: Y[400], border: "none", borderRadius: 8, padding: "7px 0", fontSize: 13, fontWeight: 500, color: Y[900], cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingCaption(false)} style={{ flex: 1, background: Y[100], border: "none", borderRadius: 8, padding: "7px 0", fontSize: 13, color: Y[700], cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div>
                    <p style={{ margin: "0 0 4px", fontSize: 14, color: "#333", lineHeight: 1.5 }}>{selectedPhoto.caption || <span style={{ color: Y[400], fontStyle: "italic" }}>no caption</span>}</p>
                    <span style={{ fontSize: 11, background: Y[100], color: Y[700], borderRadius: 99, padding: "2px 10px" }}>{selectedPhoto.places?.name}</span>
                    {selectedPhoto.memory_date && <span style={{ fontSize: 11, color: Y[600], marginLeft: 8 }}>{new Date(selectedPhoto.memory_date).toLocaleDateString()}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                    <button onClick={(e) => toggleLike(selectedPhoto, e)} style={{ background: Y[100], border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: Y[700], cursor: "pointer" }}>❤️ {selectedPhoto.likes || 0}</button>
                    <button onClick={() => setEditingCaption(true)} style={{ background: Y[100], border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: Y[700], cursor: "pointer" }}>✏️ Edit</button>
                    <button onClick={() => deletePhoto(selectedPhoto.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "#b91c1c", cursor: "pointer" }}>🗑️</button>
                  </div>
                </div>
              )}

              {/* Comments */}
              <div style={{ borderTop: `1.5px solid ${Y[100]}`, paddingTop: "0.75rem" }}>
                <p style={{ margin: "0 0 0.75rem", fontSize: 13, fontWeight: 500, color: Y[800] }}>💬 Comments</p>
                {comments.length === 0 && <p style={{ fontSize: 13, color: Y[600], margin: "0 0 0.75rem" }}>No comments yet — be the first! 🌼</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "0.75rem" }}>
                  {comments.map(c => (
                    <div key={c.id} style={{ background: Y[50], borderRadius: 10, padding: "8px 12px", border: `1px solid ${Y[200]}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <p style={{ margin: 0, fontSize: 13, color: "#444", lineHeight: 1.4 }}>{c.text}</p>
                      <button onClick={() => deleteComment(c.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#ccc", marginLeft: 8, flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newComment} onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addComment()}
                    placeholder="Leave a comment..."
                    style={{ flex: 1, borderRadius: 10, border: `1.5px solid ${Y[200]}`, padding: "9px 12px", fontSize: 14, background: Y[50], color: Y[800] }} />
                  <button onClick={addComment} style={{ background: Y[400], border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 500, fontSize: 14, color: Y[900], cursor: "pointer" }}>Post</button>
                </div>
              </div>

              <button onClick={() => setSelectedPhoto(null)} style={{ marginTop: "1rem", width: "100%", background: Y[100], border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, color: Y[700], cursor: "pointer", fontWeight: 500 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Memory Lane Slideshow */}
      {showMemoryLane && memoryLaneList.length > 0 && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
          <button onClick={closeMemoryLane} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 999, width: 40, height: 40, color: "#fff", fontSize: 18, cursor: "pointer" }}>✕</button>
          <button onClick={prevSlide} style={{ position: "absolute", left: 16, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 999, width: 44, height: 44, color: "#fff", fontSize: 20, cursor: "pointer" }}>‹</button>
          <button onClick={nextSlide} style={{ position: "absolute", right: 16, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 999, width: 44, height: 44, color: "#fff", fontSize: 20, cursor: "pointer" }}>›</button>
          <div style={{ maxWidth: "85vw", maxHeight: "80vh", textAlign: "center" }}>
            <img src={memoryLaneList[memoryLaneIndex].url} alt={memoryLaneList[memoryLaneIndex].caption} style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 16, objectFit: "contain" }} />
            {memoryLaneList[memoryLaneIndex].caption && <p style={{ color: "#fff", marginTop: 16, fontSize: 15 }}>{memoryLaneList[memoryLaneIndex].caption}</p>}
            <p style={{ color: Y[200], fontSize: 13, marginTop: 4 }}>{memoryLaneList[memoryLaneIndex].places?.name}</p>
          </div>
        </div>
      )}

      {/* Map View */}
      {showMap && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 700, height: "80vh", overflow: "hidden", border: `2px solid ${Y[200]}`, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1.5px solid ${Y[100]}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: Y[800] }}>📍 Our places</p>
              <button onClick={() => setShowMap(false)} style={{ background: Y[100], border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 13, color: Y[700], cursor: "pointer" }}>Close</button>
            </div>
            <div style={{ flex: 1 }}>
              <MapContainer center={mapCenter} zoom={placesWithCoords.length ? 7 : 6} style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                {placesWithCoords.map(place => (
                  <Marker key={place.id} position={[place.latitude, place.longitude]}>
                    <Popup>
                      <div style={{ textAlign: "center" }}>
                        <strong>{place.name}</strong>
                        <p style={{ margin: "4px 0" }}>{photos.filter(p => p.place_id === place.id).length} memories</p>
                        <button onClick={() => { setActiveTab(place.name); setShowMap(false); }} style={{ background: Y[400], border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>View</button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "1.5rem", width: "100%", maxWidth: 380, border: `2px solid ${Y[200]}`, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: 18, fontWeight: 500, color: Y[800] }}>Add a memory 🌼</h2>
            {previewUrls.length > 0 && (
              <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: "0.75rem" }}>
                {previewUrls.map((url, i) => (
                  <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                    <img src={url} alt="preview" style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 10 }} />
                    <button onClick={() => removeSelectedFile(i)} style={{ position: "absolute", top: -6, right: -6, background: "#fff", border: `1px solid ${Y[200]}`, borderRadius: 999, width: 20, height: 20, fontSize: 11, cursor: "pointer", color: "#b91c1c", lineHeight: 1 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <input type="file" accept="image/*" multiple ref={fileRef} onChange={handleFiles} style={{ display: "none" }} />
            <button onClick={() => fileRef.current.click()}
              style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1.5px dashed ${Y[400]}`, background: Y[50], color: Y[700], cursor: "pointer", marginBottom: "0.75rem", fontSize: 14 }}>
              {previewUrls.length ? `Change photos (${previewUrls.length} selected)` : "Upload photos"}
            </button>
            <input placeholder="Add a caption..." value={uploadForm.caption} onChange={e => setUploadForm(f => ({ ...f, caption: e.target.value }))}
              style={{ width: "100%", borderRadius: 10, border: `1.5px solid ${Y[200]}`, padding: "10px 12px", fontSize: 14, marginBottom: "0.75rem", boxSizing: "border-box", background: Y[50], color: Y[800] }} />
            <label style={{ fontSize: 12, color: Y[600], display: "block", marginBottom: 4 }}>When did this happen?</label>
            <input type="date" value={uploadForm.memory_date} onChange={e => setUploadForm(f => ({ ...f, memory_date: e.target.value }))}
              style={{ width: "100%", borderRadius: 10, border: `1.5px solid ${Y[200]}`, padding: "10px 12px", fontSize: 14, marginBottom: "0.75rem", boxSizing: "border-box", background: Y[50], color: Y[800] }} />
            {places.length > 0 ? (
              <select value={uploadForm.place_id} onChange={e => setUploadForm(f => ({ ...f, place_id: e.target.value }))}
                style={{ width: "100%", borderRadius: 10, border: `1.5px solid ${Y[200]}`, padding: "10px 12px", fontSize: 14, marginBottom: "1rem", background: Y[50], color: Y[800] }}>
                {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : (
              <p style={{ fontSize: 13, color: Y[600], marginBottom: "1rem" }}>No places yet — add some via ✏️ Places first.</p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleAddPhoto} disabled={uploadFiles.length === 0 || !uploadForm.place_id || uploading}
                style={{ flex: 1, background: Y[400], border: "none", borderRadius: 10, padding: "11px 0", fontWeight: 500, fontSize: 14, color: Y[900], cursor: "pointer", opacity: (uploadFiles.length === 0 || !uploadForm.place_id || uploading) ? 0.5 : 1 }}>
                {uploading ? `Saving ${uploadProgress}...` : "Save memory"}
              </button>
              <button onClick={() => setShowUpload(false)} style={{ flex: 1, background: Y[100], border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, color: Y[700], cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Places Modal */}
      {showManage && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "1.5rem", width: "100%", maxWidth: 360, border: `2px solid ${Y[200]}`, maxHeight: "80vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: 18, fontWeight: 500, color: Y[800] }}>Manage places 📍</h2>
            {places.length === 0 && <p style={{ fontSize: 14, color: Y[600], marginBottom: "1rem" }}>No places yet. Add one below!</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "1.25rem" }}>
              {places.map(place => (
                <div key={place.id} style={{ background: Y[50], borderRadius: 12, padding: "10px 12px", border: `1.5px solid ${Y[200]}` }}>
                  {editingPlace?.id === place.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input value={editPlaceVal} onChange={e => setEditPlaceVal(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && renamePlace()}
                        autoFocus
                        style={{ width: "100%", borderRadius: 8, border: `1.5px solid ${Y[400]}`, padding: "8px 10px", fontSize: 14, background: "#fff", color: Y[800], boxSizing: "border-box" }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={renamePlace} style={{ flex: 1, background: Y[400], border: "none", borderRadius: 8, padding: "7px 0", fontSize: 13, fontWeight: 500, color: Y[900], cursor: "pointer" }}>Save name</button>
                        <button onClick={() => setEditingPlace(null)} style={{ flex: 1, background: Y[100], border: "none", borderRadius: 8, padding: "7px 0", fontSize: 13, color: Y[700], cursor: "pointer" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 14, color: Y[800], fontWeight: 500 }}>{place.name}</span>
                      <button onClick={() => { setEditingPlace(place); setEditPlaceVal(place.name); }}
                        style={{ background: Y[100], border: `1px solid ${Y[200]}`, borderRadius: 8, padding: "6px 14px", fontSize: 13, color: Y[700], cursor: "pointer" }}>Rename</button>
                      <button onClick={() => deletePlace(place)}
                        style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 14px", fontSize: 13, color: "#b91c1c", cursor: "pointer" }}>Delete</button>
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
              style={{ width: "100%", background: Y[100], border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, color: Y[700], cursor: "pointer", fontWeight: 500 }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}