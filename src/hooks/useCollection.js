import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

// Realtime subscription to a Firestore collection.
// orderField is optional; pass null to skip ordering.
export default function useCollection(collectionName, orderField = 'createdAt', direction = 'desc') {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ref = collection(db, collectionName);
    const q = orderField ? query(ref, orderBy(orderField, direction)) : ref;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setDocuments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`Error loading ${collectionName}:`, err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [collectionName, orderField, direction]);

  return { documents, loading, error };
}
