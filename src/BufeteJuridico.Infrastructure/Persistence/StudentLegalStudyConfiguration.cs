using BufeteJuridico.Domain.Students;
using Microsoft.EntityFrameworkCore;

namespace BufeteJuridico.Infrastructure.Persistence;

internal static class StudentLegalStudyConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<StudentLegalReview>(entity =>
        {
            entity.ToTable("student_legal_reviews");
            entity.Property(item => item.ReviewType).HasConversion<string>().HasMaxLength(32);
            entity.Property(item => item.Observations).HasMaxLength(4000);
            entity.HasIndex(item => new { item.StudentId, item.ReviewDate });
            entity.HasOne(item => item.Student).WithMany().HasForeignKey(item => item.StudentId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(item => item.Student.DeletedAtUtc == null);
        });
        modelBuilder.Entity<StudentPracticeClosure>(entity =>
        {
            entity.ToTable("student_practice_closures");
            entity.Property(item => item.Notes).HasMaxLength(4000);
            entity.HasIndex(item => item.StudentId).IsUnique();
            entity.HasIndex(item => item.DeliveryDate);
            entity.HasOne(item => item.Student).WithMany().HasForeignKey(item => item.StudentId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(item => item.Student.DeletedAtUtc == null);
        });
    }
}
