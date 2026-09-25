iniciar servidor

cd D:\github\MacaquinhoOnline
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000



bugs pra arrumar,
se por uma banana e um pepino os 3 vão tentar ir na banana e não vão pegar o pepino mesmo com fome
-> resolvido com o mapa: agora só disputam quem está na mesma célula da comida, e quem estava mais perto antes de se mover tem prioridade