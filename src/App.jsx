import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://elazbfrcbqdbjugxwpho.supabase.co",
  "sb_publishable_KkMJwhiAZenfbdX-cWH5Sw_s90UiVrc"
);

const Y = {
  50: "#FFFBEA", 100: "#FFF3C4", 200: "#FCE588",
  400: "#FACC15", 600: "#CA8A04", 700: "#A16207", 800: "#854D0E", 900: "#431407"
};

export default function App() {
  const [places, setPlaces] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [activeTab, setActiveTab] = useState("All Memories");
  const [loading, setLoading] = useState(true);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ caption: "", place_id: "" });
  const [uploadFile, setUploadFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [showManage, setShowManage] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [editingPlace, setEditingPlace] = useState(null);
  const [editPlaceVal, setEditPlaceVal] = useState("");

  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [editPhotoCaption, setEditPhotoCaption] = useState("");
  const [editingCaption, setEditingCaption] = useState(false);

  const fileRef = useRef();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: p }, { data: ph }] = await Promise.all([
      supabase.from("places").select("*").order("created_at"),
      supabase.from("photos").select("*, places(name)").order("created_at", { ascending: false })
    ]);
    setPlaces(p || []);
    setPhotos(ph || []);
    setLoading(false);
  }

  async function loadComments(photoId) {
    const { data } = await supabase.from("comments").select("*").eq("photo_id", photoId).order("created_at");
    setComments(data || []);
  }

  const filtered = activeTab === "All Memories"
    ? photos
    : photos.filter(p => p.places?.name === activeTab);

  // Places
  async function addPlace() {
    const t = newPlaceName.trim();
    if (!t) return;
    const { data } = await supabase.from("places").insert({ name: t }).select().single();
    if (data) { setPlaces(p => [...p, data]); setNewPlaceName(""); }
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
  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleAddPhoto() {
    if (!uploadFile || !uploadForm.place_id) return;
    setUploading(true);
    const ext = uploadFile.name.split(".").pop();
    const filename = `${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("our-memories").upload(filename, uploadFile);
    if (upErr) { alert("Upload failed: " + upErr.message); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("our-memories").getPublicUrl(filename);
    const { data } = await supabase.from("photos").insert({ url: publicUrl, caption: uploadForm.caption, place_id: uploadForm.place_id }).select("*, places(name)").single();
    if (data) setPhotos(p => [data, ...p]);
    setShowUpload(false);
    setUploadFile(null);
    setPreviewUrl(null);
    setUploadForm({ caption: "", place_id: "" });
    setUploading(false);
  }

  async function deletePhoto(id) {
    await supabase.from("photos").delete().eq("id", id);
    setPhotos(p => p.filter(ph => ph.id !== id));
    setSelectedPhoto(null);
  }

  async function saveCaption() {
    await supabase.from("photos").update({ caption: editPhotoCaption }).eq("id", selectedPhoto.id);
    setPhotos(p => p.map(ph => ph.id === selectedPhoto.id ? { ...ph, caption: editPhotoCaption } : ph));
    setSelectedPhoto(s => ({ ...s, caption: editPhotoCaption }));
    setEditingCaption(false);
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
    setEditingCaption(false);
    setNewComment("");
    loadComments(photo.id);
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: Y[800] }}>🌼 Our Memories</h1>
            <p style={{ margin: 0, fontSize: 13, color: Y[600] }}>every moment we've shared, saved forever</p>
          </div>
          <button onClick={() => { setShowUpload(true); setUploadForm({ caption: "", place_id: places[0]?.id || "" }); setPreviewUrl(null); setUploadFile(null); }}
            style={{ background: Y[400], border: "none", borderRadius: 999, padding: "8px 18px", fontWeight: 500, fontSize: 14, color: Y[900], cursor: "pointer" }}>
            + Add memory
          </button>
        </div>
        <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
          {["All Memories", ...places.map(p => p.name)].map(tab => (
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

      {/* Pinterest Grid */}
      <div style={{ padding: "1.5rem", columns: "2 160px", gap: "0.75rem" }}>
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
            {(photo.caption || photo.places?.name) && (
              <div style={{ padding: "8px 10px 10px" }}>
                {photo.caption && <p style={{ margin: "0 0 4px", fontSize: 12, color: "#444", lineHeight: 1.4 }}>{photo.caption}</p>}
                {photo.places?.name && <span style={{ fontSize: 10, background: Y[100], color: Y[700], borderRadius: 99, padding: "2px 8px" }}>{photo.places.name}</span>}
              </div>
            )}
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
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
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

      {/* Upload Modal */}
      {showUpload && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
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
              <select value={uploadForm.place_id} onChange={e => setUploadForm(f => ({ ...f, place_id: e.target.value }))}
                style={{ width: "100%", borderRadius: 10, border: `1.5px solid ${Y[200]}`, padding: "10px 12px", fontSize: 14, marginBottom: "1rem", background: Y[50], color: Y[800] }}>
                {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : (
              <p style={{ fontSize: 13, color: Y[600], marginBottom: "1rem" }}>No places yet — add some via ✏️ Places first.</p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleAddPhoto} disabled={!uploadFile || !uploadForm.place_id || uploading}
                style={{ flex: 1, background: Y[400], border: "none", borderRadius: 10, padding: "11px 0", fontWeight: 500, fontSize: 14, color: Y[900], cursor: "pointer", opacity: (!uploadFile || !uploadForm.place_id || uploading) ? 0.5 : 1 }}>
                {uploading ? "Saving..." : "Save memory"}
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