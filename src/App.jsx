import { useState, useEffect } from "react";

// ─── ตั้งค่า ─────────────────────────────────────────────────────────────────
const LIFF_ID = "2010548613-ST8oae00";
const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbzdfBIHtTaaalPHKk_BcNyUj5edtuD5oYwLzgzsGHH5sKUCROxXHZ50qMbgddUlhFN7hg/exec";

// ─── LIFF ───────────────────────────────────────────────────────────────────
function useLiff() {
  const [user, setUser]   = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        if (!window.liff) {
          await new Promise((res, rej) => {
            const s = document.createElement("script");
            s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
            s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
          });
        }
        await window.liff.init({ liffId: LIFF_ID });

        if (window.liff.isLoggedIn()) {
          const p = await window.liff.getProfile();
          setUser({ name: p.displayName, pic: p.pictureUrl, id: p.userId });
        } else {
          if (window.liff.isInClient()) {
            window.liff.login();
          } else {
            setUser({ name: "ครู (ทดสอบ)", pic: null, id: "dev" });
          }
        }
      } catch {
        setUser({ name: "ครู (ทดสอบ)", pic: null, id: "dev" });
      }
      setReady(true);
    };
    init();
  }, []);

  return { user, ready };
}

// ─── ข้อมูลห้องเรียน ────────────────────────────────────────────────────────
const KINDERGARTEN_CLASSROOMS = [
  "เด็กเล็ก 1", "เด็กเล็ก 2",
  "อ.1/1", "อ.1/2", "อ.1/3", "อ.1/4", "อ.1/5",
  "อ.2/1", "อ.2/2", "อ.2/3", "อ.2/4",
  "อ.3/1", "อ.3/2", "อ.3/3", "อ.3/4",
];

const PRIMARY_CLASSROOMS = [
  "ป.1/1", "ป.1/2", "ป.1/3", "ป.1/4",
  "ป.2/1", "ป.2/2", "ป.2/3",
  "ป.3/1", "ป.3/2", "ป.3/3", "ป.3/4",
  "ป.4/1", "ป.4/2", "ป.4/3",
  "ป.5/1", "ป.5/2", "ป.5/3",
  "ป.6/1", "ป.6/2", "ป.6/3",
];

const TRUCK_DEFAULT = {
  "เด็กเล็ก 1": 1, "เด็กเล็ก 2": 1,
  "อ.1/1": 1, "อ.1/3": 1, "อ.1/4": 1, "อ.1/5": 1,
  "อ.2/1": 1, "อ.2/2": 1,
  "อ.3/1": 2, "อ.3/4": 2,
  "อ.1/2": 2, "อ.2/3": 2, "อ.2/4": 2,
  "อ.3/2": 2, "อ.3/3": 2,
};

const ALLERGY_PRESETS = [
  "อิสลาม","แพ้กุ้ง","แพ้ถั่ว","แพ้นมวัว","แพ้ไข่",
  "แพ้แป้งสาลี","แพ้ปลา","แพ้แตงโม","แพ้มะละกอ","แพ้ขนมจีน",
  "แพ้ข้าวเหนียว","แพ้กล้วย","แพ้ชมพู่","แพ้อาหารทะเล",
];

function fmtTime(date) {
  return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function getTermAndWeek(date) {
  // ปรับตามปฏิทินโรงเรียนจริงภายหลังได้ — ตอนนี้ใช้ค่าประมาณอย่างง่าย
  const month = date.getMonth() + 1;
  const term = month >= 5 && month <= 9 ? "เทอม 1" : "เทอม 2";
  const week = Math.ceil(date.getDate() / 7);
  return { term, week };
}

function allergiesToText(allergies) {
  return allergies.map(a => `${a.name}:${a.count}`).join(", ");
}

// ─── Confirm Modal ───────────────────────────────────────────────────────────
function ConfirmModal({ classroom, level, total, truck, allergies, teacherName, onConfirm, onCancel, sending }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
        <p className="text-xl font-black text-gray-800 mb-1">ยืนยันการส่งข้อมูล?</p>
        <p className="text-gray-400 text-sm mb-4">กรุณาตรวจสอบก่อนกดยืนยัน</p>
        <div className="bg-orange-50 rounded-2xl p-4 mb-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">ครูผู้รายงาน</span>
            <span className="font-semibold text-gray-700">{teacherName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">ห้อง</span>
            <span className="font-bold text-gray-800">{classroom}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">จำนวนนักเรียน</span>
            <span className="font-black text-orange-600 text-lg">{total} คน</span>
          </div>
          {level === "อนุบาล" && (
            <div className="flex justify-between">
              <span className="text-gray-500">รถ</span>
              <span className={`font-bold ${truck===1?"text-blue-600":"text-green-600"}`}>คันที่ {truck}</span>
            </div>
          )}
          {allergies.length > 0 && (
            <div className="pt-1 border-t border-orange-100">
              <p className="text-gray-500 mb-1">ข้อมูลพิเศษ</p>
              {allergies.map(a => (
                <p key={a.name} className="text-red-600 text-sm font-medium">• {a.name} {a.count} คน</p>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={sending} className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-500 font-semibold disabled:opacity-40">
            ← แก้ไข
          </button>
          <button onClick={onConfirm} disabled={sending} className="flex-1 py-3 rounded-2xl bg-orange-500 text-white font-bold shadow-md disabled:opacity-60">
            {sending ? "⏳ กำลังส่ง..." : "✅ ยืนยัน"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Teacher Form ────────────────────────────────────────────────────────────
function TeacherForm({ onSubmit, submissions, user }) {
  const [level, setLevel]             = useState("อนุบาล"); // อนุบาล | ประถม
  const [classroom, setClassroom]     = useState("");
  const [total, setTotal]             = useState(20);
  const [truck, setTruck]             = useState(1);
  const [allergies, setAllergies]     = useState([]);
  const [allergyName, setAllergyName] = useState("");
  const [allergyCount, setAllergyCount] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [doneClass, setDoneClass]     = useState(null);
  const [editMode, setEditMode]       = useState(false);
  const [sending, setSending]         = useState(false);
  const [sendError, setSendError]     = useState(null);

  const classroomList = level === "อนุบาล" ? KINDERGARTEN_CLASSROOMS : PRIMARY_CLASSROOMS;
  const existing = submissions.find(s => s.classroom === classroom);

  const handleLevelChange = (val) => {
    setLevel(val);
    setClassroom("");
    setDoneClass(null);
    setEditMode(false);
    setAllergies([]);
  };

  const handleClassroomChange = (val) => {
    setClassroom(val);
    setDoneClass(null);
    setEditMode(false);
    const prev = submissions.find(s => s.classroom === val);
    if (prev) {
      setTotal(prev.total);
      setTruck(prev.truck || 1);
      setAllergies(prev.allergies);
    } else {
      setTotal(20);
      setTruck(TRUCK_DEFAULT[val] || 1);
      setAllergies([]);
    }
  };

  const addAllergy = (name) => {
    const n = name.trim();
    if (!n) return;
    const ex = allergies.find(a => a.name === n);
    if (ex) {
      setAllergies(allergies.map(a => a.name === n ? { ...a, count: a.count + allergyCount } : a));
    } else {
      setAllergies([...allergies, { name: n, count: allergyCount }]);
    }
    setAllergyName(""); setAllergyCount(1);
  };

  const removeAllergy = (name) => setAllergies(allergies.filter(a => a.name !== name));

  const handleConfirm = async () => {
    setSending(true);
    setSendError(null);

    const now = new Date();
    const { term, week } = getTermAndWeek(now);

    const payload = {
      date: now.toLocaleDateString("th-TH"),
      time: fmtTime(now),
      term,
      week,
      level,
      classroom,
      total,
      truck: level === "อนุบาล" ? truck : "",
      allergies: allergiesToText(allergies),
      teacherName: user?.name || "ไม่ระบุ",
    };

    try {
      await fetch(SHEET_API_URL, {
        method: "POST",
        mode: "no-cors", // Apps Script web app ไม่รองรับ CORS preflight แบบปกติ
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload),
      });

      onSubmit({
        classroom, level, total, truck, allergies,
        time: now,
        edited: editMode,
        teacherName: user?.name || "ไม่ระบุ",
        teacherId: user?.id || "unknown",
      });
      setDoneClass(classroom);
      setShowConfirm(false);
      setEditMode(false);
    } catch (err) {
      setSendError("ส่งข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSending(false);
    }
  };

  const startEdit = () => { setEditMode(true); setDoneClass(null); };

  if (doneClass) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="text-7xl">✅</div>
        <p className="text-xl font-black text-green-700">ส่งข้อมูลแล้ว!</p>
        <p className="text-gray-400">{doneClass} — {total} คน{level === "อนุบาล" ? ` · รถคันที่ ${truck}` : ""}</p>
        <div className="flex gap-3 mt-4 w-full">
          <button onClick={startEdit} className="flex-1 py-3 rounded-2xl border-2 border-orange-200 text-orange-600 font-semibold text-sm">
            ✏️ แก้ไขห้องนี้
          </button>
          <button onClick={() => { setDoneClass(null); setClassroom(""); }} className="flex-1 py-3 rounded-2xl bg-orange-500 text-white font-bold text-sm shadow">
            + ส่งห้องใหม่
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      {showConfirm && (
        <ConfirmModal
          classroom={classroom} level={level} total={total} truck={truck}
          allergies={allergies} teacherName={user?.name || "ไม่ระบุ"}
          sending={sending}
          onConfirm={handleConfirm} onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-400 rounded-2xl p-5 text-white shadow-lg">
        <p className="text-xs opacity-80 mb-1">รายงานยอดอาหารกลางวัน</p>
        <p className="text-2xl font-bold">อาหารโรงเรียน 🍱</p>
        <p className="text-sm opacity-80 mt-1">
          {new Date().toLocaleDateString("th-TH", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
        </p>
        {user && (
          <div className="flex items-center gap-2 mt-3 bg-white/20 rounded-xl px-3 py-2">
            {user.pic
              ? <img src={user.pic} className="w-7 h-7 rounded-full" alt="profile" />
              : <span className="text-lg">👤</span>
            }
            <p className="text-sm font-semibold">{user.name}</p>
          </div>
        )}
      </div>

      {/* เลือกระดับชั้น */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-orange-50 flex gap-2">
        <button onClick={() => handleLevelChange("อนุบาล")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${level==="อนุบาล" ? "bg-orange-500 text-white shadow-sm" : "text-gray-400"}`}>
          🧸 อนุบาล
        </button>
        <button onClick={() => handleLevelChange("ประถม")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${level==="ประถม" ? "bg-blue-500 text-white shadow-sm" : "text-gray-400"}`}>
          🎒 ประถม
        </button>
      </div>

      {/* เลือกห้อง */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-50">
        <label className="block text-sm font-semibold text-gray-500 mb-2">📚 ห้องเรียน</label>
        <select
          value={classroom}
          onChange={e => handleClassroomChange(e.target.value)}
          className="w-full border-2 border-orange-100 rounded-xl p-3 text-lg font-semibold focus:border-orange-400 focus:outline-none bg-orange-50"
        >
          <option value="">— เลือกห้อง —</option>
          {classroomList.map(c => {
            const done = submissions.find(s => s.classroom === c);
            return (
              <option key={c} value={c}>
                {done ? "✓ " : ""}{c}{done ? ` (${done.total} คน)` : ""}
              </option>
            );
          })}
        </select>
        {existing && !editMode && (
          <div className="mt-2 bg-orange-50 rounded-xl px-3 py-2 flex items-center justify-between">
            <p className="text-orange-600 text-sm">ส่งข้อมูลแล้ว เมื่อ {fmtTime(existing.time)}</p>
            <button onClick={startEdit} className="text-xs text-orange-500 font-semibold underline">แก้ไข</button>
          </div>
        )}
      </div>

      {classroom && (
        <>
          {/* Slider จำนวนนักเรียน */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-50">
            <label className="block text-sm font-semibold text-gray-500 mb-3">👨‍🎓 จำนวนนักเรียนวันนี้</label>
            <div className="text-center mb-3">
              <span className="text-6xl font-black text-orange-500">{total}</span>
              <span className="text-gray-400 text-lg ml-2">คน</span>
            </div>
            <input
              type="range" min={1} max={45} value={total}
              onChange={e => setTotal(parseInt(e.target.value))}
              className="w-full accent-orange-500 h-3 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-300 mt-1 px-1">
              <span>1</span><span>15</span><span>30</span><span>45</span>
            </div>
            <div className="flex gap-3 mt-3 justify-center">
              <button onClick={() => setTotal(t => Math.max(1, t - 1))}
                className="w-12 h-12 rounded-xl bg-orange-100 text-orange-700 text-2xl font-bold active:bg-orange-200">−</button>
              <div className="flex-1 flex items-center justify-center bg-orange-50 rounded-xl">
                <span className="text-orange-500 text-sm font-medium">ปรับทีละ 1</span>
              </div>
              <button onClick={() => setTotal(t => Math.min(45, t + 1))}
                className="w-12 h-12 rounded-xl bg-orange-100 text-orange-700 text-2xl font-bold active:bg-orange-200">+</button>
            </div>
          </div>

          {/* ข้อมูลพิเศษ */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-50">
            <label className="block text-sm font-semibold text-gray-500 mb-3">⚠️ ข้อมูลพิเศษ (ถ้ามี)</label>

            {allergies.length > 0 && (
              <div className="space-y-2 mb-3">
                {allergies.map(a => (
                  <div key={a.name} className="flex items-center justify-between bg-red-50 rounded-xl px-3 py-2">
                    <span className="text-red-700 font-medium text-sm">{a.name}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setAllergies(allergies.map(x => x.name===a.name ? {...x, count: Math.max(1,x.count-1)} : x))}
                        className="w-7 h-7 bg-red-100 rounded-lg text-red-600 font-bold text-sm">−</button>
                      <span className="text-red-700 font-black w-6 text-center">{a.count}</span>
                      <button onClick={() => setAllergies(allergies.map(x => x.name===a.name ? {...x, count: x.count+1} : x))}
                        className="w-7 h-7 bg-red-100 rounded-lg text-red-600 font-bold text-sm">+</button>
                      <span className="text-red-400 text-xs">คน</span>
                      <button onClick={() => removeAllergy(a.name)}
                        className="w-7 h-7 bg-red-200 rounded-lg text-red-600 font-bold text-sm ml-1">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-400 mb-2">เลือกได้เลย:</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {ALLERGY_PRESETS.filter(p => !allergies.find(a => a.name === p)).map(p => (
                <button key={p} onClick={() => setAllergyName(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    allergyName === p
                      ? "bg-red-500 text-white border-red-500"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-red-300 hover:text-red-600"
                  }`}>
                  {p}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text" value={allergyName}
                onChange={e => setAllergyName(e.target.value)}
                placeholder="หรือพิมพ์เอง..."
                className="flex-1 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm focus:border-red-300 focus:outline-none"
              />
              <div className="flex items-center gap-1 bg-gray-50 border-2 border-gray-100 rounded-xl px-2">
                <button onClick={() => setAllergyCount(c => Math.max(1, c-1))} className="text-gray-400 font-bold w-5">−</button>
                <span className="text-sm font-bold text-gray-700 w-4 text-center">{allergyCount}</span>
                <button onClick={() => setAllergyCount(c => c+1)} className="text-gray-400 font-bold w-5">+</button>
              </div>
              <button onClick={() => addAllergy(allergyName)}
                disabled={!allergyName.trim()}
                className="px-3 py-2 bg-red-500 text-white rounded-xl text-sm font-bold disabled:opacity-30">
                + เพิ่ม
              </button>
            </div>
          </div>

          {/* รถ — เฉพาะอนุบาล */}
          {level === "อนุบาล" && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-50">
              <label className="block text-sm font-semibold text-gray-500 mb-3">🚗 รถส่งอาหาร</label>
              <div className="grid grid-cols-2 gap-3">
                {[1,2].map(t => (
                  <button key={t} onClick={() => setTruck(t)}
                    className={`py-4 rounded-xl text-lg font-bold border-2 transition-all ${
                      truck===t
                        ? t===1 ? "border-blue-500 bg-blue-500 text-white shadow-md" : "border-green-500 bg-green-500 text-white shadow-md"
                        : "border-gray-200 bg-gray-50 text-gray-400"
                    }`}>
                    🚗 คันที่ {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sendError && (
            <div className="bg-red-50 border-2 border-red-200 text-red-600 text-sm rounded-xl px-3 py-2 text-center">
              {sendError}
            </div>
          )}

          <button
            onClick={() => setShowConfirm(true)}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 text-white text-xl font-bold shadow-lg active:scale-95 transition-transform"
          >
            {editMode ? "✅ บันทึกการแก้ไข" : "✅ ส่งข้อมูล"}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Kitchen Dashboard ───────────────────────────────────────────────────────
function KitchenDashboard({ submissions }) {
  const kinder = submissions.filter(s => s.level === "อนุบาล");
  const primary = submissions.filter(s => s.level === "ประถม");

  const truck1   = kinder.filter(s => s.truck === 1);
  const truck2   = kinder.filter(s => s.truck === 2);
  const total1   = truck1.reduce((sum, s) => sum + s.total, 0);
  const total2   = truck2.reduce((sum, s) => sum + s.total, 0);
  const primaryTotal = primary.reduce((sum, s) => sum + s.total, 0);
  const totalAll = total1 + total2 + primaryTotal;

  const allClassrooms = [...KINDERGARTEN_CLASSROOMS, ...PRIMARY_CLASSROOMS];
  const done     = submissions.length;
  const pending  = allClassrooms.filter(c => !submissions.find(s => s.classroom === c));
  const pct      = Math.round((done / allClassrooms.length) * 100);

  const allergyMap = {};
  submissions.forEach(s => s.allergies.forEach(a => {
    allergyMap[a.name] = (allergyMap[a.name] || 0) + a.count;
  }));

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Header + Progress */}
      <div className="bg-gradient-to-r from-green-600 to-teal-500 rounded-2xl p-5 text-white shadow-lg">
        <p className="text-xs opacity-80 mb-1">แดชบอร์ดห้องครัว</p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-4xl font-black">{totalAll}</p>
            <p className="text-sm opacity-80">คนทั้งหมด</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black">{done}<span className="text-base font-normal opacity-70">/{allClassrooms.length}</span></p>
            <p className="text-xs opacity-80">ห้องที่ส่งแล้ว</p>
          </div>
        </div>
        <div className="mt-3 bg-white/20 rounded-full h-2.5">
          <div className="bg-white rounded-full h-2.5 transition-all duration-500" style={{width:`${pct}%`}} />
        </div>
        <p className="text-xs opacity-70 mt-1 text-right">{pct}%</p>
      </div>

      {/* สรุปอนุบาล (รถ) */}
      <div>
        <p className="text-sm font-bold text-gray-500 mb-2 px-1">🧸 อนุบาล</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-center">
            <p className="text-blue-600 font-semibold text-sm mb-1">🚗 รถคันที่ 1</p>
            <p className="text-4xl font-black text-blue-700">{total1}</p>
            <p className="text-blue-400 text-xs mt-1">{truck1.length} ห้อง</p>
          </div>
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 text-center">
            <p className="text-green-600 font-semibold text-sm mb-1">🚗 รถคันที่ 2</p>
            <p className="text-4xl font-black text-green-700">{total2}</p>
            <p className="text-green-400 text-xs mt-1">{truck2.length} ห้อง</p>
          </div>
        </div>
      </div>

      {/* สรุปประถม */}
      <div>
        <p className="text-sm font-bold text-gray-500 mb-2 px-1">🎒 ประถม</p>
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 text-center">
          <p className="text-indigo-600 font-semibold text-sm mb-1">ยอดรวมประถม</p>
          <p className="text-4xl font-black text-indigo-700">{primaryTotal}</p>
          <p className="text-indigo-400 text-xs mt-1">{primary.length} ห้อง</p>
        </div>
      </div>

      {/* รายการพิเศษรวม */}
      {Object.keys(allergyMap).length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
          <p className="text-red-700 font-bold text-sm mb-3">⚠️ รายการพิเศษวันนี้ (รวมทุกห้อง)</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(allergyMap).map(([name, count]) => (
              <div key={name} className="bg-white border border-red-100 rounded-xl px-3 py-2 flex justify-between items-center">
                <span className="text-red-700 text-sm font-medium">{name}</span>
                <span className="text-red-500 font-black">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* รายละเอียดอนุบาล รถ 1 */}
      {truck1.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
          <div className="bg-blue-500 px-4 py-3 flex justify-between items-center">
            <p className="text-white font-bold">🚗 รถคันที่ 1</p>
            <p className="text-white font-black text-xl">{total1} คน</p>
          </div>
          {truck1.map(s => (
            <ClassroomRow key={s.classroom} s={s} color="text-blue-600" />
          ))}
        </div>
      )}

      {/* รายละเอียดอนุบาล รถ 2 */}
      {truck2.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-green-100 overflow-hidden">
          <div className="bg-green-500 px-4 py-3 flex justify-between items-center">
            <p className="text-white font-bold">🚗 รถคันที่ 2</p>
            <p className="text-white font-black text-xl">{total2} คน</p>
          </div>
          {truck2.map(s => (
            <ClassroomRow key={s.classroom} s={s} color="text-green-600" />
          ))}
        </div>
      )}

      {/* รายละเอียดประถม */}
      {primary.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden">
          <div className="bg-indigo-500 px-4 py-3 flex justify-between items-center">
            <p className="text-white font-bold">🎒 ประถม</p>
            <p className="text-white font-black text-xl">{primaryTotal} คน</p>
          </div>
          {primary.map(s => (
            <ClassroomRow key={s.classroom} s={s} color="text-indigo-600" />
          ))}
        </div>
      )}

      {/* ห้องที่รอ */}
      {pending.length > 0 && (
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
          <p className="text-gray-500 font-semibold text-sm mb-2">⏳ รอข้อมูล ({pending.length} ห้อง)</p>
          <div className="flex flex-wrap gap-1">
            {pending.map(c => (
              <span key={c} className="text-xs bg-white border border-gray-200 text-gray-400 px-2 py-1 rounded-lg">{c}</span>
            ))}
          </div>
        </div>
      )}

      {submissions.length === 0 && (
        <div className="text-center py-16 text-gray-300">
          <p className="text-5xl mb-3">🍱</p>
          <p className="font-medium text-lg">รอครูส่งข้อมูล...</p>
        </div>
      )}
    </div>
  );
}

function ClassroomRow({ s, color }) {
  return (
    <div className="px-4 py-3 flex items-start justify-between border-b border-gray-50 last:border-0">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-800">{s.classroom}</p>
          {s.edited && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">แก้ไขแล้ว</span>}
        </div>
        <p className="text-xs text-gray-300 mt-0.5">
          ส่งเมื่อ {fmtTime(s.time)} · {s.teacherName}
        </p>
        {s.allergies.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {s.allergies.map(a => (
              <span key={a.name} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                {a.name} {a.count}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className={`text-2xl font-black ${color}`}>{s.total}</span>
    </div>
  );
}

// ─── Loading Screen ──────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-5xl mb-4">🍱</p>
        <p className="text-gray-500 font-medium">กำลังโหลด...</p>
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const { user, ready } = useLiff();
  const [tab, setTab]   = useState("teacher");
  const [submissions, setSubmissions] = useState([]);

  if (!ready) return <LoadingScreen />;

  const handleSubmit = (data) => {
    setSubmissions(prev => [...prev.filter(s => s.classroom !== data.classroom), data]);
  };

  const allClassrooms = [...KINDERGARTEN_CLASSROOMS, ...PRIMARY_CLASSROOMS];
  const pending = allClassrooms.length - submissions.length;

  return (
    <div className="min-h-screen bg-orange-50">
      <div className="max-w-md mx-auto">
        <div className="sticky top-0 z-10 bg-orange-50 pt-3 px-4 pb-2">
          <div className="flex gap-2 bg-white rounded-2xl p-1 shadow-sm border border-orange-100">
            <button onClick={() => setTab("teacher")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab==="teacher" ? "bg-orange-500 text-white shadow-sm" : "text-gray-400"}`}>
              📝 ครูกรอกข้อมูล
            </button>
            <button onClick={() => setTab("kitchen")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all relative ${tab==="kitchen" ? "bg-green-500 text-white shadow-sm" : "text-gray-400"}`}>
              👨‍🍳 ห้องครัว
              {pending > 0 && submissions.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{pending}</span>
              )}
            </button>
          </div>
        </div>

        <div className="px-4 pt-2">
          {tab === "teacher"
            ? <TeacherForm onSubmit={handleSubmit} submissions={submissions} user={user} />
            : <KitchenDashboard submissions={submissions} />
          }
        </div>
      </div>
    </div>
  );
}
