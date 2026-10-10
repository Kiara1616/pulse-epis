"""Deterministic, isolated read-only examples; never writes to the roster DB."""
import json
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from ..db.base import Base
from ..db.models import AcademicPeriod, Student, Issuer, Skill, Certification, FactCertification, FactStudentPeriod
from .service import AnalyticsService


@lru_cache(maxsize=1)
def demo_analytics():
    engine = create_engine("sqlite+pysqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    catalogs = [
        ("AWS", "AWS Cloud Practitioner", ["Cloud Computing", "Seguridad en la nube"]),
        ("Cisco", "CCNA", ["Redes", "Ciberseguridad"]),
        ("Microsoft", "Azure Fundamentals", ["Cloud Computing"]),
        ("Oracle", "Oracle Database SQL", ["Bases de datos", "SQL"]),
        ("Google Cloud", "Cloud Digital Leader", ["Cloud Computing", "Análisis de datos"]),
        ("Scrum.org", "Professional Scrum Master", ["Gestión ágil"]),
    ]
    periods = json.loads((Path(__file__).resolve().parents[2] / "data/academic-periods-upt.json").read_text())
    with factory.begin() as session:
        issuers = {name: Issuer(name=name) for name, _, _ in catalogs}
        skills = {name: Skill(name=name) for _, _, names in catalogs for name in names}
        students = [Student(student_key=f"demo-student-{i:04d}", entry_year=2018+i%9, status="ACTIVE") for i in range(360)]
        session.add_all([*issuers.values(), *skills.values(), *students]); session.flush()
        for n, spec in enumerate(periods):
            start, end = date.fromisoformat(spec["starts_on"]), date.fromisoformat(spec["ends_on"])
            period = AcademicPeriod(code=spec["code"], name=spec["code"], starts_on=start, ends_on=end)
            session.add(period); session.flush()
            # All counts are demonstration values, including 2026; none are
            # presented as official enrollment totals from a screenshot.
            count = 220 + n*10
            cutoff = min(end, date(2026, 10, 10))
            records = []
            for i, student in enumerate(students[:count]):
                if i % 5 == 0 or i >= 35 + n*8:
                    continue
                issuer_name, name, names = catalogs[(i+n)%len(catalogs)]
                issued = start + timedelta(days=10+i%35)
                cert = Certification(student_id=student.id, issuer_id=issuers[issuer_name].id,
                    credential_name=name, issued_on=issued, expires_on=cutoff+timedelta(days=45+i%180), status="APPROVED")
                session.add(cert); session.flush()
                records.append((student, cert, names))
                if i%7 == 0:
                    other_issuer, other_name, other_names = catalogs[(i+n+1)%len(catalogs)]
                    other = Certification(student_id=student.id, issuer_id=issuers[other_issuer].id,
                        credential_name=other_name, issued_on=issued+timedelta(days=1), status="APPROVED")
                    session.add(other); session.flush(); records.append((student, other, other_names))
            for point in sorted({start+timedelta(days=14), start+timedelta(days=35), cutoff}):
                certs = [(s,c,ns) for s,c,ns in records if c.issued_on <= point]
                per_student = {}
                for student, cert, names in certs:
                    per_student[student.id] = per_student.get(student.id,0)+1
                    session.add_all([FactCertification(certification_id=cert.id, skill_id=skills[skill].id, cutoff_date=point,
                        period_id=period.id, issuer_id=cert.issuer_id, status="APPROVED", level="Other",
                        issued_on=cert.issued_on, expires_on=cert.expires_on) for skill in names])
                for i, student in enumerate(students[:count]):
                    year = max(start.year-4, start.year-i%5)
                    session.add(FactStudentPeriod(student_key=student.student_key, period_id=period.id, cutoff_date=point,
                        cohort=str(year), cycle=["I","II","III","IV","V","VI","VII","VIII","IX","X"][i%10],
                        enrollment_status="ACTIVE", certification_count=per_student.get(student.id,0),
                        approved_certification_count=per_student.get(student.id,0)))
    return AnalyticsService(factory)
